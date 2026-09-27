import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InboxService, IngestResult } from './inbox.service';
import { IngestEventDto, toInboundEnvelope } from './ingest-event.dto';
import { IngestResultDto, RegisteredHandlersDto } from './inbox-response.dto';
import { ErrorResponseDto } from '../../common/dto';

/**
 * Entrada manual de eventos.
 *
 * Existe porque **M9 todavía no expuso el bus**: sin esto no hay forma de
 * ejercitar los consumidores ni de demostrar el circuito completo. Con
 * `RABBITMQ_URL` configurada, `RabbitMqConsumer` entra por el mismo camino
 * (mismos pipes, mismo `ingest()`) y este endpoint queda como herramienta de
 * operación y de prueba.
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
      'Recibe un sobre y lo despacha al handler que corresponda. La idempotencia es por eventId: un mensaje ya recibido se descarta sin volver a aplicar el efecto, que es lo que exige la regla 1 del enunciado. Un evento sin handler se registra y se descarta sin romper. Si el handler falla, la fila queda sin procesar y con el error registrado; no se reintenta sola, y reenviar el mismo eventId devuelve duplicate.',
  })
  @ApiResponse({
    status: 200,
    type: IngestResultDto,
    description:
      'Resultado de la ingesta: processed, duplicate (ya recibido), ignored (sin handler) o failed',
  })
  @ApiResponse({
    status: 400,
    description:
      'Sobre inválido, o data sin los campos obligatorios de un evento con handler (no se guarda: se puede reenviar corregido con el mismo eventId)',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async ingest(@Body() dto: IngestEventDto): Promise<IngestResult> {
    return this.inbox.ingest(toInboundEnvelope(dto));
  }

  @Get('handlers')
  @ApiOperation({
    summary: 'Listar los eventos que M6 sabe procesar',
    description:
      'Los tipos con handler registrado. Sirve para verificar qué está conectado sin leer el código.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tipos de evento con handler',
    type: RegisteredHandlersDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async handlers(): Promise<RegisteredHandlersDto> {
    return { eventTypes: this.inbox.registeredTypes() };
  }
}
