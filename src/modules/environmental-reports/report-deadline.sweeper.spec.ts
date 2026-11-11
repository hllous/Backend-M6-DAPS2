import { Logger } from '@nestjs/common';
import { EnvironmentalReportStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportDeadlineSweeper } from './report-deadline.sweeper';

describe('ReportDeadlineSweeper', () => {
  let prisma: any;
  let sweeper: ReportDeadlineSweeper;

  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    prisma = {
      environmentalReport: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    sweeper = new ReportDeadlineSweeper(prisma as unknown as PrismaService);
  });

  it('cierra solo los NOTICE_ISSUED con el plazo vencido a la hora actual', async () => {
    vi.useFakeTimers({ now: new Date('2026-03-01T10:00:00Z'), toFake: ['Date'] });
    try {
      await sweeper.closeExpired();
    } finally {
      vi.useRealTimers();
    }

    const [[args]] = prisma.environmentalReport.updateMany.mock.calls;
    expect(args.where).toEqual({
      status: EnvironmentalReportStatus.NOTICE_ISSUED,
      deadlineAt: { lt: new Date('2026-03-01T10:00:00Z') },
    });
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
  it('si la base no responde al arrancar, no tumba el arranque y deja una advertencia con la causa', async () => {
    prisma.environmentalReport.updateMany.mockRejectedValue(new Error('base dormida'));
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await expect(sweeper.onModuleInit()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('base dormida');
  });

  describe('trazas del barrido', () => {
    it('informa cuántos expedientes cerró cuando cerró alguno', async () => {
      const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

      await sweeper.closeExpired();

      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0][0]).toContain('2 expediente');
    });

    it('no loguea nada si no había vencidos', async () => {
      prisma.environmentalReport.updateMany.mockResolvedValue({ count: 0 });
      const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

      await sweeper.closeExpired();

      expect(log).not.toHaveBeenCalled();
    });
  });
});
