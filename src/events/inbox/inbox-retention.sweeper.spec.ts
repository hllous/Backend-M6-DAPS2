import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { InboxRetentionSweeper } from './inbox-retention.sweeper';

describe('InboxRetentionSweeper', () => {
  let prisma: any;
  const build = (days?: number) =>
    new InboxRetentionSweeper(
      prisma as unknown as PrismaService,
      { get: vi.fn(() => days) } as unknown as ConfigService,
    );

  beforeEach(() => {
    prisma = { inboxEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) } };
  });

  it('borra solo procesadas recibidas antes del corte', async () => {
    const now = new Date('2026-11-05T03:00:00Z');
    await build(180).purge(now);

    const [[args]] = prisma.inboxEvent.deleteMany.mock.calls;
    expect(args.where.processedAt).toEqual({
      not: null,
      lt: new Date('2026-05-09T03:00:00Z'),
    });
  });

  it.each([0, undefined])('con retención %s no purga', async (days) => {
    await build(days).purge();
    expect(prisma.inboxEvent.deleteMany).not.toHaveBeenCalled();
  });

  it('si la base falla no propaga el error', async () => {
    prisma.inboxEvent.deleteMany.mockRejectedValue(new Error('base dormida'));
    await expect(build(90).purge()).resolves.toBeUndefined();
  });
});
