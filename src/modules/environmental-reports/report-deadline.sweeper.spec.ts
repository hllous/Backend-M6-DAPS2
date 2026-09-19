import { EnvironmentalReportStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportDeadlineSweeper } from './report-deadline.sweeper';

describe('ReportDeadlineSweeper', () => {
  let prisma: any;
  let sweeper: ReportDeadlineSweeper;

  beforeEach(() => {
    prisma = {
      environmentalReport: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    sweeper = new ReportDeadlineSweeper(prisma as unknown as PrismaService);
  });

  it('cierra solo los NOTICE_ISSUED con el plazo vencido', async () => {
    await sweeper.closeExpired();

    const [[args]] = prisma.environmentalReport.updateMany.mock.calls;
    expect(args.where.status).toBe(EnvironmentalReportStatus.NOTICE_ISSUED);
    expect(args.where.deadlineAt.lt).toBeInstanceOf(Date);
    expect(args.data).toEqual({ status: EnvironmentalReportStatus.CLOSED });
  });

  /**
   * #150: el `@Cron` necesita el proceso vivo a la hora en punto, y en Render
   * free el servicio duerme. Sin este barrido al arrancar, los vencimientos
   * esperan a que coincidan el despertar y la hora en punto.
   */
  it('barre al arrancar, sin esperar a la hora en punto', async () => {
    await sweeper.onModuleInit();

    expect(prisma.environmentalReport.updateMany).toHaveBeenCalledTimes(1);
  });

  /**
   * Un throw en `onModuleInit` aborta el arranque de Nest: el contenedor
   * quedaría en crash-loop por un barrido que el `@Cron` reintenta solo.
   */
  it('si la base no responde al arrancar, no tumba el arranque', async () => {
    prisma.environmentalReport.updateMany.mockRejectedValue(new Error('base dormida'));

    await expect(sweeper.onModuleInit()).resolves.toBeUndefined();
  });
});
