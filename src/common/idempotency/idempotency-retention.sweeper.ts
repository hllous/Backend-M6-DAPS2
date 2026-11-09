import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

export const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1000;

/** Borra los registros de más de 24 h, incluidos los «en curso» huérfanos. Idempotente y sin lock. */
@Injectable()
export class IdempotencyRetentionSweeper {
  private readonly logger = new Logger(IdempotencyRetentionSweeper.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purge(now: Date = new Date()): Promise<void> {
    try {
      const { count } = await this.prisma.idempotencyRecord.deleteMany({
        where: { createdAt: { lt: new Date(now.getTime() - IDEMPOTENCY_RETENTION_MS) } },
      });
      if (count > 0) this.logger.log(`${count} registro/s de idempotencia vencido/s purgado/s`);
    } catch (error) {
      this.logger.warn(`No se pudo purgar la idempotencia: ${(error as Error).message}`);
    }
  }
}
