import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ServiceStatus, Severity } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InboxService } from '../inbox/inbox.service';
import { ConsumedEvent } from '../inbox/consumed-events';

/** Con menos que esto se avisa, no se reprograma. */
const SEVERIDAD_QUE_REPROGRAMA: Severity[] = [Severity.HIGH, Severity.CRITICAL];

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
    this.inbox.register(ConsumedEvent.WEATHER_ALERT_ISSUED, (d) => this.handle(d));
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

    // Solo SCHEDULED: es el único estado desde el que VALID_TRANSITIONS admite
    // RESCHEDULED, y `updateMany` no pasa por assertTransition. El filtro es el
    // guard. Un servicio ya iniciado no se reprograma por una alerta: lo
    // suspende la cuadrilla que está en la calle.
    const { count } = await this.prisma.service.updateMany({
      where: {
        status: ServiceStatus.SCHEDULED,
        zones: { some: { zoneId: { in: zoneIds } } },
        ...(desde && hasta && { scheduledDate: { gte: desde, lte: hasta } }),
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
