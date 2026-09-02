import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InboxService, IngestResult } from './inbox.service';
import { IngestEventDto } from './ingest-event.dto';
import { ErrorResponseDto } from '../../common/dto';

/**
 * Entrada manual de eventos.
 *
 * Existe porque **M9 nunca expuso un bus**: sin esto no hay forma de ejercitar
 * los consumidores ni de demostrar el circuito completo. Cuando haya broker, el
 * consumidor de Kafka llama al mismo `ingest()` y este endpoint queda como
 * herramienta de operación y de prueba.
 */
@ApiTags('events')
@ApiBearerAuth('JWT-auth')
@Controller('events')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Post('inbox')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ingerir un evento entrante',
    description:
      'Recibe un sobre y lo despacha al handler que corresponda. La idempotencia es por eventId: un mensaje ya recibido se descarta sin volver a aplicar el efecto, que es lo que exige la regla 1 del enunciado. Un evento sin handler se registra y se descarta sin romper. Si el handler falla, la fila queda sin procesar y con el error, para poder reintentarla.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Resultado de la ingesta: processed, duplicate (ya recibido), ignored (sin handler) o failed',
  })
  @ApiResponse({ status: 400, description: 'Sobre inválido', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async ingest(@Body() dto: IngestEventDto): Promise<IngestResult> {
    return this.inbox.ingest({
      specVersion: dto.specVersion ?? '1.5',
      eventId: dto.eventId,
      eventType: dto.eventType,
      eventVersion: dto.eventVersion ?? '1.0',
      occurredAt: dto.occurredAt ?? new Date().toISOString(),
      producer: dto.producer ?? 'desconocido',
      subject: dto.subject ?? '',
      data: dto.data,
    });
  }

  @Get('handlers')
  @ApiOperation({
    summary: 'Listar los eventos que M6 sabe procesar',
    description:
      'Los tipos con handler registrado. Sirve para verificar qué está conectado sin leer el código.',
  })
  @ApiResponse({ status: 200, description: 'Tipos de evento con handler' })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async handlers(): Promise<{ eventTypes: string[] }> {
    return { eventTypes: this.inbox.registeredTypes() };
  }
}
