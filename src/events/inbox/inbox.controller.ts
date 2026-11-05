import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InboxService, IngestResult } from './inbox.service';
import { InboxAdminService } from './inbox-admin.service';
import {
  InboxEventDetailResponseDto,
  InboxEventResponseDto,
  QueryInboxDto,
} from './inbox-admin.dto';
import { IngestEventDto, toInboundEnvelope } from './ingest-event.dto';
import { IngestResultDto, RegisteredHandlersDto } from './inbox-response.dto';
import { ErrorResponseDto, PaginatedResponseDto } from '../../common/dto';
import { ApiPaginatedResponse, Roles } from '../../common/decorators';
import { ROLES_ADMIN, ROLES_OUTBOX_LECTURA } from '../../auth/role-groups';

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
  constructor(
    private readonly inbox: InboxService,
    private readonly inboxAdmin: InboxAdminService,
  ) {}

  @Post('inbox')
  @Roles(...ROLES_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ingerir un evento entrante',
    description:
      'Recibe un sobre y lo despacha al handler que corresponda. La idempotencia es por eventId: un mensaje ya procesado se descarta sin volver a aplicar el efecto, que es lo que exige la regla 1 del enunciado. Un evento sin handler se registra y se descarta sin romper. Si el handler falla, la fila queda sin procesar y con el error registrado, y reenviar el mismo eventId vuelve a correr el handler con el payload guardado en la primera entrega (es lo que hace el reintento del Core por el bus). Un reenvío con otro eventType, o mientras el intento anterior sigue en curso, sale duplicate.',
  })
  @ApiResponse({
    status: 200,
    type: IngestResultDto,
    description:
      'Resultado de la ingesta: processed, duplicate (ya procesado o en curso), ignored (sin handler) o failed',
  })
  @ApiResponse({
    status: 400,
    description:
      'Sobre inválido, o data sin los campos obligatorios de un evento con handler (no se guarda: se puede reenviar corregido con el mismo eventId)',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Solo M6_ADMIN puede inyectar eventos a mano',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async ingest(@Body() dto: IngestEventDto): Promise<IngestResult> {
    return this.inbox.ingest(toInboundEnvelope(dto));
  }

  @Get('inbox')
  @Roles(...ROLES_OUTBOX_LECTURA)
  @ApiOperation({
    summary: 'Listar los eventos entrantes recibidos',
    description:
      'Listado paginado para el Monitor de integración, del más reciente al más viejo por `receivedAt`, con estado derivado (`processed`, `failed`, `pending`) y error acotado. Filtra por `status`, `eventType`, `sourceModule` y rango de `receivedAt` (días argentinos, inclusivos). No incluye el payload, que es de terceros y puede traer datos personales: está en el detalle, solo para admin.',
  })
  @ApiPaginatedResponse(InboxEventResponseDto, 'Listado paginado de eventos entrantes')
  @ApiResponse({
    status: 400,
    description: 'Parámetros inválidos (estado desconocido, fecha mal formada, `from` > `to`)',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Solo M6_ADMIN y M6_AUDITOR pueden ver el inbox',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findAll(
    @Query() query: QueryInboxDto,
  ): Promise<PaginatedResponseDto<InboxEventResponseDto>> {
    return this.inboxAdmin.findAll(query);
  }

  @Get('inbox/:messageId')
  @Roles(...ROLES_ADMIN)
  @ApiOperation({
    summary: 'Detalle de un evento entrante, con su payload',
    description:
      'Devuelve el evento tal como se guardó, con el payload recibido. Solo admin, porque el payload es de terceros y puede incluir datos personales.',
  })
  @ApiParam({ name: 'messageId', description: 'eventId del sobre', example: 'ev-0001' })
  @ApiResponse({
    status: 200,
    description: 'Evento con payload',
    type: InboxEventDetailResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Solo M6_ADMIN puede ver el payload',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 404, description: 'No existe ese evento', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findOne(@Param('messageId') messageId: string): Promise<InboxEventDetailResponseDto> {
    return this.inboxAdmin.findOne(messageId);
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
