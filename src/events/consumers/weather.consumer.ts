import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ServiceStatus, Severity } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toDateOnly } from '../../common/utils/date-only';
import { InboxService } from '../inbox/inbox.service';
import { ConsumedEvent } from '../inbox/consumed-events';
import { Data, esFecha, esTexto, esUuid, requerido } from '../inbox/payload-validation';

/** Con menos que esto se avisa, no se reprograma. */
const SEVERIDAD_QUE_REPROGRAMA: Severity[] = [Severity.HIGH, Severity.CRITICAL];

function validar(d: Data): string[] {
  const problemas = requerido(d, ['severity'], 'string', esTexto);
  const reprograma = SEVERIDAD_QUE_REPROGRAMA.includes(
    String(d.severity ?? '').toUpperCase() as Severity,
  );
  // Los uuid solo se exigen si la alerta reprograma: es donde el handler usa los
  // zoneIds en el updateMany. El catálogo de zonas de M9 sigue abierto, así que
  // para una alerta leve alcanza con que haya zonas.
  const zonas = Array.isArray(d.zoneIds) ? d.zoneIds : [];
  if (zonas.length === 0 || (reprograma && !zonas.every(esUuid))) {
    problemas.push(reprograma ? 'zoneIds (array no vacío de uuid)' : 'zoneIds (array no vacío)');
  }
  if (reprograma) {
    problemas.push(
      ...requerido(d, ['from'], 'fecha ISO 8601', esFecha),
      ...requerido(d, ['to'], 'fecha ISO 8601', esFecha),
    );
  }
  return problemas;
}

/**
 * La alerta meteorológica, **simulada internamente**.
 *
 * No es un evento de otro módulo: ningún grupo de la cohorte publica nada
 * equivalente y no se lo pedimos a nadie
 * (docs/eventos/consumidos/weatherAlertIssued.md). Se consume igual que los
 * demás porque desde el punto de vista del módulo es lo mismo: hay un handler
 * que reacciona a un evento entrante. La diferencia es de dónde sale.
 *
 * Si M9 expone algún día una integración meteorológica real, se reemplaza el
 * origen y el handler no cambia.
 */
@Injectable()
export class WeatherConsumer implements OnModuleInit {
  private readonly logger = new Logger(WeatherConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inbox: InboxService,
  ) {}

  onModuleInit(): void {
    this.inbox.register(ConsumedEvent.WEATHER_ALERT_ISSUED, (d) => this.handle(d), {
      validate: validar,
    });
  }

  /**
   * Marca para reprogramar los servicios agendados en las zonas afectadas
   * dentro de la ventana de la alerta.
   *
   * Quedan en `RESCHEDULED`, no en una fecha nueva: es exactamente el caso para
   * el que ese estado existe — se sabe que hay que moverlos y todavía no se
   * sabe adónde. La fecha la pone después el operador con `confirm-reschedule`.
   */
  private async handle(data: Record<string, unknown>): Promise<void> {
    const severity = String(data.severity ?? '').toUpperCase() as Severity;
    const zoneIds = (data.zoneIds ?? []) as string[];
    const desde = data.from ? new Date(String(data.from)) : null;
    const hasta = data.to ? new Date(String(data.to)) : null;

    if (!zoneIds.length) {
      this.logger.warn('weatherAlertIssued sin zoneIds: no hay a qué aplicarlo, se descarta');
      return;
    }
    if (!SEVERIDAD_QUE_REPROGRAMA.includes(severity)) {
      this.logger.log(
        `weatherAlertIssued ${data.alertType ?? ''} severidad ${severity}: se avisa, no se reprograma`,
      );
      return;
    }

    // Sin ventana completa no se reprograma: filtrar solo por zona movería
    // todos los servicios agendados de esas zonas, en cualquier fecha.
    if (!desde || !hasta || isNaN(desde.getTime()) || isNaN(hasta.getTime())) {
      this.logger.warn(
        'weatherAlertIssued sin from/to válidos: no se sabe qué fechas mover, se descarta',
      );
      return;
    }

    // Solo SCHEDULED: es el único estado desde el que VALID_TRANSITIONS admite
    // RESCHEDULED, y `updateMany` no pasa por assertTransition. El filtro es el
    // guard. Un servicio ya iniciado no se reprograma por una alerta: lo
    // suspende la cuadrilla que está en la calle.
    const { count } = await this.prisma.service.updateMany({
      where: {
        status: ServiceStatus.SCHEDULED,
        zones: { some: { zoneId: { in: zoneIds } } },
        // scheduledDate es @db.Date: sin truncar, un `from` con hora deja
        // afuera los servicios de ese mismo día.
        scheduledDate: { gte: toDateOnly(desde), lte: toDateOnly(hasta) },
      },
      data: {
        status: ServiceStatus.RESCHEDULED,
        statusReason: `Alerta meteorológica ${data.alertType ?? ''} (${severity})`.trim(),
      },
    });

    this.logger.log(
      `weatherAlertIssued: ${count} servicio/s marcado/s para reprogramar en ${zoneIds.length} zona/s`,
    );
  }
}
