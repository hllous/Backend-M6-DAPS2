import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EnvironmentalReportStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Cierra los expedientes cuyo plazo venció sin respuesta de M4.
 *
 * **No es un atajo, es el diseño** (docs/entidades/environmental-report.md):
 * M4 no publica ningún evento cuando decide que no corresponde castigo, así
 * que sin este cierre el expediente quedaría en NOTICE_ISSUED para siempre.
 *
 * El costo asumido es que una desestimación de M4 y una demora de M4 se ven
 * igual desde acá. Se aceptó a cambio de no depender de que otro grupo agregue
 * un evento.
 *
 * Cierra sin SanctionOutcome: no hubo resolución que espejar.
 */
@Injectable()
export class ReportDeadlineSweeper {
  private readonly logger = new Logger(ReportDeadlineSweeper.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async closeExpired(): Promise<void> {
    const { count } = await this.prisma.environmentalReport.updateMany({
      where: {
        status: EnvironmentalReportStatus.NOTICE_ISSUED,
        deadlineAt: { lt: new Date() },
      },
      data: { status: EnvironmentalReportStatus.CLOSED },
    });

    if (count > 0) {
      this.logger.log(
        `${count} expediente/s cerrado/s por vencimiento del plazo sin respuesta de M4`,
      );
    }
  }
}
