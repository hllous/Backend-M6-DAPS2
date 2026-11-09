import { Module } from '@nestjs/common';
import { IdempotencyRetentionSweeper } from './idempotency-retention.sweeper';

/** Solo el barrido: el interceptor lo instancia cada controller (PrismaService es global). */
@Module({ providers: [IdempotencyRetentionSweeper] })
export class IdempotencyModule {}
