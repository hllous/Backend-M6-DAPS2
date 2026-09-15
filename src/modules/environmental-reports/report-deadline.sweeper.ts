import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
export class ReportDeadlineSweeper implements OnModuleInit {
  private readonly logger = new Logger(ReportDeadlineSweeper.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Barre también al arrancar, no solo a la hora en punto.
   *
   * El `@Cron` exige que el proceso esté vivo justo en ese minuto, y en el free
   * tier de Render el servicio duerme a los 15 minutos sin tráfico. El
   * keepalive no lo evita: GitHub corre los workflows programados cada 2-3
   * horas, no cada 10 minutos como pide el cron (#150). Barriendo al arrancar,
   * despertar equivale a ponerse al día y la cadencia del ping deja de
   * importar.
   *
   * El barrido es idempotente —`updateMany` sobre los vencidos—, así que
   * repetirlo no cuesta nada.
   *
   * No propaga el error: si la base todavía no acepta conexiones, un throw acá
   * aborta el arranque de Nest y deja el contenedor en crash-loop. El `@Cron`
   * vuelve a intentarlo dentro de la hora.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.closeExpired();
    } catch (error) {
      this.logger.warn(
        `El barrido de vencimientos falló al arrancar; se reintenta en la próxima hora: ${
          (error as Error).message
        }`,
      );
    }
  }

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
