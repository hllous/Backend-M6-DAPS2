import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  EnvironmentalReportStatus as S,
  EnvironmentalReportType,
  Prisma,
  ServiceStatus,
  Severity,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InboxService } from '../inbox/inbox.service';
import { ConsumedEvent, TicketUpdateType } from '../inbox/consumed-events';
import { Data, esObjeto, esTexto, requerido } from '../inbox/payload-validation';
import { REPORT_TRANSITIONS } from '../../modules/environmental-reports/environmental-reports.service';

/**
 * Cómo nos nombra M2 en `responsibleAreaId`: el identificador canónico `Mx` de
 * su §4/§5.1, no el `sourceModule` del Core ('ambiente').
 */
const AREA_M6 = 'M6';

/** El nombre visible del Request Type de M2, mapeado a nuestro catálogo. */
const TIPO_POR_PALABRA: [RegExp, EnvironmentalReportType][] = [
  [/ruido|sonor/i, EnvironmentalReportType.NOISE],
  [/basural|microbasural/i, EnvironmentalReportType.ILLEGAL_DUMPSITE],
  [/vertido|efluente|liquid/i, EnvironmentalReportType.WATER_DISCHARGE],
  [/humo|emisi|aire/i, EnvironmentalReportType.AIR_EMISSION],
  [/olor/i, EnvironmentalReportType.ODOR],
  [/plaga|roedor|insect/i, EnvironmentalReportType.PEST_INFESTATION],
  [/volcado|descarga/i, EnvironmentalReportType.DUMPING],
];

/** La marca de orden de cada dato que M2 pisa (#270). Ver `noAtrasado()`. */
type Marca = 'priorityChangedAt' | 'escalationChangedAt' | 'citizenResponseAt' | 'ticketStatusAt';

/** Los que escriben "gana el último" y por eso ordenan por occurredAt (#270). */
const ORDENADOS: string[] = [
  TicketUpdateType.PRIORITY_CHANGED,
  TicketUpdateType.ESCALATION_CHANGED,
  TicketUpdateType.INFORMATION_PROVIDED,
  TicketUpdateType.REOPENED,
  TicketUpdateType.CANCELLED,
];

const PRIORIDAD: Record<string, Severity> = {
  LOW: Severity.LOW,
  MEDIUM: Severity.MEDIUM,
  HIGH: Severity.HIGH,
  CRITICAL: Severity.CRITICAL,
  URGENT: Severity.CRITICAL,
};

/**
 * `ticketUpdated` de M2, el único evento suyo que escuchamos y **nuestro único
 * disparador de entrada**.
 *
 * La v1.6 define trece `updateType`. Seis disparan acción y **siete se ignoran
 * a propósito**: el doc pide explícitamente no implementarles handler, y están
 * enumerados en su tabla para que quede escrito que la omisión es deliberada y
 * no haya que volver a auditarla contra el contrato.
 *
 * Los siete que no hacen nada: CONTENT_UPDATED, PROGRESS, DUPLICATE_LINKED,
 * INFORMATION_REQUIRED, STATUS_CHANGED, RESOLVED y CLOSED.
 *
 * **El orden de llegada no es el de M2** (#270): el Core reintenta un handler
 * fallido hasta ~21 min después, detrás de eventos más nuevos del mismo
 * ticket. Lo que pisa un dato compara su `occurredAt` con la marca de ese dato
 * en el expediente y, si no es más nuevo, se ignora (sale `processed`:
 * reintentarlo no lo haría más nuevo).
 */
@Injectable()
export class TicketsConsumer implements OnModuleInit {
  private readonly logger = new Logger(TicketsConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inbox: InboxService,
  ) {}

  onModuleInit(): void {
    // §2 y §11 del contrato de M2: el ticket de otro módulo se ignora y no se
    // persiste su contenido, tampoco en el inbox. La regla es la misma que filtra
    // en handle().
    this.inbox.register(ConsumedEvent.TICKET_UPDATED, (d, at) => this.handle(d, at), {
      persistPayload: (d) => this.esNuestro(d),
      validate: (d) => this.validar(d),
    });
  }

  /**
   * Lo común a los trece `updateType` (filtro y correlación) y, solo para un
   * ticket nuestro, lo que exigen las variantes que dependen de un campo de
   * `details`. Los tickets de otros módulos no se validan más allá de lo común.
   */
  private validar(d: Data): string[] {
    const problemas = [
      ...requerido(d, ['ticketId'], 'string', esTexto),
      ...requerido(d, ['updateType'], 'string', esTexto),
    ];
    // responsibleAreaId no se exige: un ticket todavía sin área responsable es
    // legítimo y simplemente no es nuestro (los tests del inbox lo cubren).
    if (problemas.length || !this.esNuestro(d)) return problemas;

    if (d.updateType === TicketUpdateType.PRIORITY_CHANGED) {
      problemas.push(...requerido(d, ['currentPriority'], 'string', esTexto));
    }
    if (d.updateType === TicketUpdateType.ESCALATION_CHANGED) {
      const details = esObjeto(d.details) ? d.details : {};
      const escalation = esObjeto(details.escalation) ? details.escalation : {};
      if (typeof escalation.active !== 'boolean') {
        problemas.push('details.escalation.active (boolean)');
      }
    }
    return problemas;
  }

  private esNuestro(data: Record<string, unknown>): boolean {
    return data.responsibleAreaId === AREA_M6;
  }

  private async handle(data: Record<string, unknown>, at: Date | null): Promise<void> {
    const updateType = String(data.updateType ?? '');
    const ticketId = data.ticketId as string | undefined;

    if (!ticketId) {
      this.logger.warn('ticketUpdated sin ticketId: no se puede correlacionar, se descarta');
      return;
    }

    // ticketUpdated es un broadcast logico (§2): llega a todos los modulos y
    // responsibleAreaId es quien de negocio le toca actuar, no un target
    // tecnico. El propio contrato lo dice explicito — "la correccion del
    // sistema no depende de ese filtrado" — asi que el filtro es nuestro, no
    // de la infraestructura. Sin esto, un reclamo derivado a cualquier otro
    // modulo abriria igual un expediente de este lado.
    if (!this.esNuestro(data)) {
      this.logger.log(
        `ticketUpdated/${updateType}: responsibleAreaId=${String(data.responsibleAreaId ?? '(ausente)').slice(0, 32)} no es nuestro, se descarta`,
      );
      return;
    }

    if (!at && ORDENADOS.includes(updateType)) {
      this.logger.warn(
        `ticketUpdated/${updateType} (${ticketId}) sin occurredAt: se aplica sin poder ordenarlo`,
      );
    }

    switch (updateType) {
      case TicketUpdateType.ROUTED:
        return this.routed(ticketId, data);
      case TicketUpdateType.CANCELLED:
        return this.cancelled(ticketId, at);
      case TicketUpdateType.PRIORITY_CHANGED:
        return this.priorityChanged(ticketId, data, at);
      case TicketUpdateType.INFORMATION_PROVIDED:
        return this.informationProvided(ticketId, data, at);
      case TicketUpdateType.REOPENED:
        return this.reopened(ticketId, at);
      case TicketUpdateType.ESCALATION_CHANGED:
        return this.escalationChanged(ticketId, data, at);
      default:
        // Los siete restantes se descartan a propósito.
        this.logger.log(`ticketUpdated/${updateType}: sin efecto operativo, se descarta`);
    }
  }

  /**
   * La entrada. Abre el expediente ambiental.
   *
   * **`responsibleAreaId` dice si el ROUTED es nuestro**, y sigue siendo campo
   * común en la v1.6: no hay que adivinar ni necesitar el catálogo de
   * `requestTypeId`. El snapshot operativo, en cambio, se lee de
   * `details.routing` — ver `routing()`.
   *
   * ponytail: abre siempre un expediente, nunca un `Service` puntual. Abrir un
   * servicio directo necesitaría el catálogo de Request Types que M2 no
   * publicó, y el expediente es la entrada diseñada para el reclamo del vecino
   * — de él sale la inspección, y de la inspección el servicio.
   */
  private async routed(ticketId: string, data: Record<string, unknown>): Promise<void> {
    const existente = await this.prisma.environmentalReport.findFirst({ where: { ticketId } });
    if (existente) {
      this.logger.log(`ticketUpdated/ROUTED: el ticket ${ticketId} ya tiene expediente abierto`);
      return;
    }

    const routing = this.routing(data);
    const location = (routing.location ?? {}) as Record<string, unknown>;
    const nombre = `${this.requestTypeName(routing.requestType)} ${routing.summary ?? ''}`;

    const report = await this.prisma.environmentalReport.create({
      data: {
        ticketId,
        // Campo común desde la v1.70 (§7.1). Solo para mostrar y buscar: la
        // correlación sigue siendo por ticketId.
        publicId: typeof data.publicId === 'string' ? data.publicId : null,
        reportType: this.tipoDeDenuncia(nombre),
        address: this.direccion(location),
        // La v1.6 sacó latitude/longitude de `location` (§5.4): quedan en null
        // salvo que M2 las mande igual. Se georreferencia por `address`.
        lat: location.latitude != null ? Number(location.latitude) : null,
        lng: location.longitude != null ? Number(location.longitude) : null,
        priority: this.prioridad(data.currentPriority),
        // El snapshot trae el escalamiento vigente (§7.4). Si M2 lo escaló antes
        // de derivar, no va a llegar un ESCALATION_CHANGED que lo marque.
        escalated: this.escalado(routing.escalation) ?? false,
        // Solo lo que el vecino aceptó exponer: si es anónimo no guardamos
        // identidad.
        reporterSnapshot: data.isAnonymous
          ? { isAnonymous: true }
          : { isAnonymous: false, citizenId: data.citizenId ?? null },
        status: S.RECEIVED,
      },
    });

    this.logger.log(
      `ticketUpdated/ROUTED: expediente ${report.id} abierto para el reclamo ${ticketId} (${report.reportType})`,
    );
  }

  /**
   * El vecino canceló: se cancela el servicio ya programado.
   *
   * El `where` filtra por los dos estados desde los que `VALID_TRANSITIONS`
   * admite `CANCELLED`. Es la única garantía: `updateMany` no pasa por
   * `assertTransition`, así que el filtro **es** el guard. Si algún día se
   * agrega un estado cancelable, hay que sumarlo acá también.
   *
   * Deja la marca `ticketStatusAt` aunque el expediente no cambie de estado: es
   * lo que hace descartar un REOPENED anterior que llegue reintentado después.
   *
   * Todo en una transacción y la marca primero: el update que la deja toma el
   * lock de la fila, así que un REOPENED más nuevo no puede colarse entre la
   * comparación y la cancelación de servicios. Si la marca no pasa, no se
   * cancela nada. Va separada del `DISMISSED` para que el guard de estado no
   * la arrastre: que el operador haya movido el expediente no frena la
   * cancelación. Sin expediente o sin occurredAt no hay marca y los servicios
   * se cancelan igual.
   */
  private async cancelled(ticketId: string, at: Date | null): Promise<void> {
    const report = await this.prisma.environmentalReport.findFirst({ where: { ticketId } });

    const count = await this.prisma.$transaction(async (tx) => {
      if (report && at) {
        const marcado = await tx.environmentalReport.updateMany({
          where: { id: report.id, ...this.noAtrasado('ticketStatusAt', at) },
          data: { ticketStatusAt: at },
        });
        if (!marcado.count) return null;
      }

      if (report?.status === S.UNDER_REVIEW) {
        // El estado leído en el `where` es el guard: si otro evento lo movió
        // entre la lectura y acá, no se pisa.
        await tx.environmentalReport.updateMany({
          where: { id: report.id, status: S.UNDER_REVIEW },
          data: { status: S.DISMISSED },
        });
      }

      const { count } = await tx.service.updateMany({
        where: {
          ticketId,
          status: { in: [ServiceStatus.SCHEDULED, ServiceStatus.RESCHEDULED] },
        },
        data: {
          status: ServiceStatus.CANCELLED,
          statusReason: 'El vecino canceló el reclamo en M2',
        },
      });
      return count;
    });

    if (count === null) return this.ignorarAtrasado('CANCELLED', ticketId, at);
    this.logger.log(
      `ticketUpdated/CANCELLED: ${count} servicio/s cancelado/s para el reclamo ${ticketId}`,
    );
  }

  /**
   * La prioridad la manda M2 y **se acepta aunque el expediente esté cerrado**:
   * es un dato del reclamo, no un cambio de estado nuestro. Decisión del
   * 04/09/2026, ver bloqueantes.md.
   *
   * Hoy este handler es el único camino por el que la prioridad cambia después
   * del alta: no existe `PATCH /environmental-reports/:id`.
   */
  private async priorityChanged(
    ticketId: string,
    data: Record<string, unknown>,
    at: Date | null,
  ): Promise<void> {
    const priority = this.prioridad(data.currentPriority);
    if (!priority) return;

    const { count } = await this.prisma.environmentalReport.updateMany({
      where: { ticketId, ...this.noAtrasado('priorityChangedAt', at) },
      data: { priority, ...(at && { priorityChangedAt: at }) },
    });
    if (!count && (await this.hayExpediente(ticketId, at))) {
      return this.ignorarAtrasado('PRIORITY_CHANGED', ticketId, at);
    }
    this.logger.log(
      `ticketUpdated/PRIORITY_CHANGED: ${count} expediente/s del reclamo ${ticketId} a ${priority}`,
    );
  }

  /**
   * Lo que el vecino respondió a nuestra solicitud de información.
   *
   * El contrato no usa ID de correlación: impone como máximo una solicitud activa
   * por ticket, así que la respuesta siempre corresponde a la nuestra.
   *
   * **Se acepta aunque el expediente esté cerrado**: perder lo que el vecino
   * contestó es peor que guardarlo tarde, y no cambia el estado del trámite.
   * Decisión del 04/09/2026, ver bloqueantes.md.
   */
  private async informationProvided(
    ticketId: string,
    data: Record<string, unknown>,
    at: Date | null,
  ): Promise<void> {
    // Lo que contestó el vecino está en `details.informationResponse.message`
    // (§7.6). `publicMessage` es la glosa de M2 ("El ciudadano aportó la
    // información solicitada."), no la respuesta: no se usa de respaldo.
    const details = (data.details ?? {}) as Record<string, unknown>;
    const message = (details.informationResponse as Record<string, unknown> | undefined)?.message;
    // ponytail: los adjuntos quedan como texto porque el expediente no tiene
    // dónde guardarlos, y la url puede ser temporal (§5.3). Campo propio si hay
    // que conservar el archivo.
    const adjuntos = Array.isArray(data.attachments)
      ? (data.attachments as Record<string, unknown>[])
          .filter((a) => a?.url)
          .map((a) => `${a.fileName ?? 'adjunto'}: ${a.url}`)
      : [];
    const respuesta = [typeof message === 'string' ? message.trim() : '', ...adjuntos]
      .filter(Boolean)
      .join('\n');

    // §7.6 garantiza al menos uno de los dos: sin ninguno, el evento es inválido.
    if (!respuesta) {
      this.logger.warn(
        `ticketUpdated/INFORMATION_PROVIDED sin message ni attachments para ${ticketId}: se descarta`,
      );
      return;
    }

    const { count } = await this.prisma.environmentalReport.updateMany({
      where: { ticketId, ...this.noAtrasado('citizenResponseAt', at) },
      data: { citizenResponse: respuesta.slice(0, 2000), ...(at && { citizenResponseAt: at }) },
    });
    if (!count && (await this.hayExpediente(ticketId, at))) {
      return this.ignorarAtrasado('INFORMATION_PROVIDED', ticketId, at);
    }
    this.logger.log(
      `ticketUpdated/INFORMATION_PROVIDED: respuesta del vecino sumada a ${count} expediente/s`,
    );
  }

  /**
   * El vecino rechazó la solución: el expediente vuelve a gestión.
   *
   * **Un expediente `CLOSED` sí se reabre.** Es lo que la tabla admite desde la
   * Fase 6 y la decisión del 04/09/2026 lo confirma: `SANCTIONED` es el único
   * cierre que no se revierte, porque eso ya lo resolvió M4. El frontend
   * asumía lo contrario — ver el aviso en bloqueantes.md.
   */
  private async reopened(ticketId: string, at: Date | null): Promise<void> {
    const report = await this.prisma.environmentalReport.findFirst({ where: { ticketId } });
    if (!report) return;

    // Un evento entrante no debería fallar duro por una carrera de estado:
    // si la reapertura no aplica desde donde está, se descarta con log.
    if (!REPORT_TRANSITIONS[report.status].includes(S.UNDER_REVIEW)) {
      this.logger.warn(
        `ticketUpdated/REOPENED: el expediente ${report.id} está en ${report.status} y no admite reapertura`,
      );
      return;
    }

    // `updateMany` no pasa por assertTransition: el estado leído (que la tabla
    // acaba de admitir) en el `where` es el guard, junto con la marca.
    const { count } = await this.prisma.environmentalReport.updateMany({
      where: { id: report.id, status: report.status, ...this.noAtrasado('ticketStatusAt', at) },
      data: { status: S.UNDER_REVIEW, ...(at && { ticketStatusAt: at }) },
    });
    if (!count) {
      this.logger.warn(
        `ticketUpdated/REOPENED (${ticketId}): el expediente ${report.id} cambió de estado mientras tanto o ya tiene un cambio igual o más nuevo, se ignora`,
      );
      return;
    }
    this.logger.log(
      `ticketUpdated/REOPENED: expediente ${report.id} vuelve a gestión desde ${report.status}`,
    );
  }

  /**
   * **Se acepta aunque el expediente esté cerrado**, por el mismo criterio que
   * `informationProvided`: marca algo que pasó del lado de M2 y no mueve el
   * trámite. Decisión del 04/09/2026, ver bloqueantes.md.
   */
  private async escalationChanged(
    ticketId: string,
    data: Record<string, unknown>,
    at: Date | null,
  ): Promise<void> {
    // §7.7: el objeto completo viaja en `details.escalation`, y §5.6 lo llama
    // `active`. Sin un booleano no se toca el flag: adivinar `true` era lo que
    // dejaba el escalado encendido para siempre.
    const details = (data.details ?? {}) as Record<string, unknown>;
    const escalated = this.escalado(details.escalation);
    if (escalated === null) {
      this.logger.warn(
        `ticketUpdated/ESCALATION_CHANGED sin details.escalation.active para ${ticketId}: se descarta`,
      );
      return;
    }

    const { count } = await this.prisma.environmentalReport.updateMany({
      where: { ticketId, ...this.noAtrasado('escalationChangedAt', at) },
      data: { escalated, ...(at && { escalationChangedAt: at }) },
    });
    if (!count && (await this.hayExpediente(ticketId, at))) {
      return this.ignorarAtrasado('ESCALATION_CHANGED', ticketId, at);
    }
    this.logger.log(
      `ticketUpdated/ESCALATION_CHANGED: ${count} expediente/s marcado/s escalated=${escalated}`,
    );
  }

  // ─── Helpers ──────────────────────────────────────

  /**
   * El filtro que deja escribir solo si el evento no es más viejo que el último
   * aplicado a ese dato. Va en el `where` del update y no en un chequeo previo:
   * comparar y escribir es una sola operación, sin carrera entre dos eventos
   * del mismo ticket. `lt` y no `lte`: un occurredAt igual a la marca es el de
   * un evento ya aplicado (el reintento de uno cuyo efecto quedó escrito), y
   * re-aplicarlo no es idempotente: un REOPENED reabriría un expediente que el
   * operador volvió a cerrar. Sin occurredAt no hay con qué comparar y se
   * aplica como antes.
   */
  private noAtrasado(marca: Marca, at: Date | null): Prisma.EnvironmentalReportWhereInput {
    return at ? { OR: [{ [marca]: null }, { [marca]: { lt: at } }] } : {};
  }

  /** Con occurredAt, un update sin filas es "atrasado" si el expediente existe. */
  private async hayExpediente(ticketId: string, at: Date | null): Promise<boolean> {
    return !!at && (await this.prisma.environmentalReport.count({ where: { ticketId } })) > 0;
  }

  private ignorarAtrasado(updateType: string, ticketId: string, at: Date | null): void {
    this.logger.warn(
      `ticketUpdated/${updateType} (${ticketId}) con occurredAt ${at?.toISOString()}: el expediente ya tiene un cambio igual o más nuevo, se ignora`,
    );
  }

  /**
   * El snapshot operativo del `ROUTED`.
   *
   * **La v1.6 revirtió un cambio de la v1.5.** En la v1.5 `requestType`,
   * `summary`, `description` y `location` eran campos comunes de todo
   * `ticketUpdated`; la v1.6 (§7.1) los sacó de la tabla de comunes y los dejó
   * solo dentro de `details.routing` (§7.4). Leerlos del nivel raíz devuelve
   * `undefined` y abre expedientes vacíos en silencio, que es exactamente lo
   * que hacía este consumer.
   *
   * Leemos `details.routing` primero y caemos al nivel raíz porque el contrato
   * sigue WIP y ya cambió de opinión una vez: aceptar las dos formas no cuesta
   * nada y nos deja indiferentes a cuál de las dos terminen publicando.
   */
  private routing(data: Record<string, unknown>): Record<string, unknown> {
    const details = (data.details ?? {}) as Record<string, unknown>;
    const routing = (details.routing ?? {}) as Record<string, unknown>;
    return { ...data, ...routing };
  }

  /**
   * El nombre visible del Request Type.
   *
   * La v1.6 (§5.5) lo serializa como **string plano** y aclara que no expone
   * los IDs internos de Category/Subcategory/RequestType. La v1.5 mandaba un
   * `catalogRef {id, name}`; se aceptan las dos formas.
   */
  private requestTypeName(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      return String((value as Record<string, unknown>).name ?? '');
    }
    return '';
  }

  /**
   * La dirección del caso.
   *
   * `addressLine` es la forma completa. Si no viene, la v1.6 (§5.4) parte el
   * dato en `street` + `streetNumber`, así que se recomponen en vez de guardar
   * la calle sin altura.
   */
  private direccion(location: Record<string, unknown>): string | null {
    const addressLine = location.addressLine as string | undefined;
    if (addressLine) return addressLine;

    const street = location.street as string | undefined;
    if (!street) return null;

    const number = location.streetNumber as string | undefined;
    return number ? `${street} ${number}` : street;
  }

  /**
   * ponytail: mapea el texto del reclamo a nuestro catálogo por palabra clave,
   * y cae en OTHER si no reconoce nada. Es lo que se puede hacer sin el
   * catálogo de Request Types de M2; cuando lo publiquen, esto se reemplaza por
   * un mapeo explícito de `requestType.id`.
   */
  private tipoDeDenuncia(texto: string): EnvironmentalReportType {
    for (const [patron, tipo] of TIPO_POR_PALABRA) {
      if (patron.test(texto)) return tipo;
    }
    return EnvironmentalReportType.OTHER;
  }

  /** `escalation.active` (§5.6), o null si no viene un booleano. */
  private escalado(escalation: unknown): boolean | null {
    const active = (escalation as Record<string, unknown> | null | undefined)?.active;
    return typeof active === 'boolean' ? active : null;
  }

  private prioridad(value: unknown): Severity | null {
    return PRIORIDAD[String(value ?? '').toUpperCase()] ?? null;
  }
}
