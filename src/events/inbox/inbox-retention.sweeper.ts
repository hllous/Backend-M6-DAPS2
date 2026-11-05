import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Purga las filas ya procesadas de `inbox_event` más viejas que
 * `INBOX_RETENTION_DAYS` (el payload completo se guarda de por vida si no).
 *
 * Solo borra `processedAt` no nulo: las pendientes y las fallidas (sin
 * `processedAt`) son las que el reintento y el Monitor necesitan. Consecuencia
 * asumida: pasado el plazo, un reenvío del mismo `eventId` ya no se detecta como
 * duplicado; el Core reintenta en minutos, no en meses. Sin lock: el borrado es
 * idempotente y corre una vez al día. No barre al arrancar (no urge, y el free
 * tier duerme el proceso: el próximo `@Cron` despierto lo hace).
 */
@Injectable()
export class InboxRetentionSweeper {
  private readonly logger = new Logger(InboxRetentionSweeper.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purge(now: Date = new Date()): Promise<void> {
    const days = this.config.get<number>('inboxRetentionDays') ?? 0;
    if (days <= 0) return;

    try {
      const { count } = await this.prisma.inboxEvent.deleteMany({
        where: {
          // El corte es por `processedAt`: una fila reprocesada hoy no se purga esa noche.
          processedAt: { not: null, lt: new Date(now.getTime() - days * DAY_MS) },
        },
      });
      // Solo la cantidad: el payload es de terceros.
      if (count > 0)
        this.logger.log(`${count} evento/s procesado/s de más de ${days} días purgado/s del inbox`);
    } catch (error) {
      // Un @Cron que lanza sería un unhandled rejection; se reintenta mañana.
      this.logger.warn(`No se pudo purgar el inbox: ${(error as Error).message}`);
    }
  }
}
