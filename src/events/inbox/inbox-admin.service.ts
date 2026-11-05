import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InboxEvent, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResponseDto } from '../../common/dto';
import { startOfDayArgentina, toDateOnly } from '../../common/utils/date-only';
import {
  InboxEventDetailResponseDto,
  InboxEventResponseDto,
  InboxStatus,
  QueryInboxDto,
} from './inbox-admin.dto';

const DAY_MS = 86_400_000;
const MAX_ERROR_LENGTH = 500;

/** Todas las columnas menos `payload`: es de terceros y solo el detalle lo devuelve. */
const SIN_PAYLOAD = {
  messageId: true,
  eventType: true,
  sourceModule: true,
  receivedAt: true,
  processedAt: true,
  occurredAt: true,
  correlationId: true,
  error: true,
} satisfies Prisma.InboxEventSelect;

/** Dónde cae cada estado derivado; el inverso es `statusOf`. */
const WHERE_BY_STATUS: Record<InboxStatus, Prisma.InboxEventWhereInput> = {
  processed: { processedAt: { not: null } },
  failed: { processedAt: null, error: { not: null } },
  pending: { processedAt: null, error: null },
};

/** Consulta de solo lectura de los eventos entrantes, para el Monitor de integración. */
@Injectable()
export class InboxAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryInboxDto): Promise<PaginatedResponseDto<InboxEventResponseDto>> {
    if (query.from && query.to && toDateOnly(query.from) > toDateOnly(query.to)) {
      throw new BadRequestException(
        `'from' (${query.from}) no puede ser posterior a 'to' (${query.to})`,
      );
    }

    const where: Prisma.InboxEventWhereInput = {
      ...(query.status && WHERE_BY_STATUS[query.status]),
      ...(query.eventType && { eventType: query.eventType }),
      ...(query.sourceModule && { sourceModule: query.sourceModule }),
      // `to` es inclusivo: antes de las 00:00 ART del día siguiente.
      ...((query.from || query.to) && {
        receivedAt: {
          ...(query.from && { gte: startOfDayArgentina(query.from) }),
          ...(query.to && { lt: new Date(startOfDayArgentina(query.to).getTime() + DAY_MS) }),
        },
      }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.inboxEvent.findMany({
        where,
        select: SIN_PAYLOAD,
        orderBy: [{ receivedAt: 'desc' }, { messageId: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.inboxEvent.count({ where }),
    ]);

    return new PaginatedResponseDto(
      rows.map((r) => this.toResponseDto(r)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findOne(messageId: string): Promise<InboxEventDetailResponseDto> {
    const event = await this.prisma.inboxEvent.findUnique({ where: { messageId } });
    if (!event) throw new NotFoundException(`Evento entrante ${messageId} no encontrado`);

    return { ...this.toResponseDto(event), payload: event.payload as Record<string, unknown> };
  }

  private statusOf(e: Pick<InboxEvent, 'processedAt' | 'error'>): InboxStatus {
    if (e.processedAt) return 'processed';
    return e.error ? 'failed' : 'pending';
  }

  private toResponseDto(e: Omit<InboxEvent, 'payload' | 'id'>): InboxEventResponseDto {
    return {
      messageId: e.messageId,
      eventType: e.eventType,
      sourceModule: e.sourceModule,
      status: this.statusOf(e),
      receivedAt: e.receivedAt,
      processedAt: e.processedAt,
      occurredAt: e.occurredAt,
      correlationId: e.correlationId,
      error: e.error === null ? null : e.error.slice(0, MAX_ERROR_LENGTH),
    };
  }
}
