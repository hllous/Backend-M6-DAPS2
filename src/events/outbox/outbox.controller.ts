import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiPaginatedResponse, CurrentUser, Roles } from '../../common/decorators';
import { ErrorResponseDto, PaginatedResponseDto } from '../../common/dto';
import { ROLES_ADMIN, ROLES_OUTBOX_LECTURA } from '../../auth/role-groups';
import { OutboxAdminService } from './outbox-admin.service';
import {
  OutboxEventDetailResponseDto,
  OutboxEventResponseDto,
  QueryOutboxDto,
  RetryFailedOutboxDto,
  RetryFailedOutboxResponseDto,
} from './dto';

/**
 * Contraparte saliente de `POST /events/inbox`: ver qué eventos salieron, cuáles
 * fallaron y por qué, y reencolar los FAILED sin entrar a la base.
 */
@ApiTags('outbox')
@ApiBearerAuth('JWT-auth')
@Controller('events/outbox')
export class OutboxController {
  constructor(private readonly outbox: OutboxAdminService) {}

  @Get()
  @Roles(...ROLES_OUTBOX_LECTURA)
  @ApiOperation({
    summary: 'Listar los eventos salientes del outbox',
    description:
      'Listado paginado, del más nuevo al más viejo, con estado, intentos y último error. Filtra por `status`, `eventType` y rango de `occurredAt` (días argentinos, inclusivos). No incluye el payload, que puede traer datos del vecino: está en el detalle, solo para admin.',
  })
  @ApiPaginatedResponse(OutboxEventResponseDto, 'Listado paginado de eventos salientes')
  @ApiResponse({
    status: 400,
    description: 'Parámetros inválidos (estado desconocido, fecha mal formada, `from` > `to`)',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findAll(
    @Query() query: QueryOutboxDto,
  ): Promise<PaginatedResponseDto<OutboxEventResponseDto>> {
    return this.outbox.findAll(query);
  }

  @Get(':id')
  @Roles(...ROLES_ADMIN)
  @ApiOperation({
    summary: 'Detalle de un evento saliente, con su payload',
    description:
      'Devuelve el evento completo: el payload tal como se publica y los reintentos manuales que se le hicieron (quién, cuándo y cómo estaba antes). Solo admin, porque el payload puede incluir datos personales.',
  })
  @ApiParam({ name: 'id', description: 'Id del evento del outbox', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Evento con payload',
    type: OutboxEventDetailResponseDto,
  })
  @ApiResponse({ status: 400, description: 'El id no es un UUID', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'No existe ese evento', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<OutboxEventDetailResponseDto> {
    return this.outbox.findOne(id);
  }

  // Declarada antes que `:id/retry` por claridad; no chocan (distinto número de segmentos).
  @Post('retry-failed')
  @Roles(...ROLES_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reencolar en lote los eventos FAILED',
    description:
      'Pasa a PENDING (attempts = 0) los FAILED más viejos, hasta `limit` (tope 100 por pedido), y audita cada uno con el usuario del token. Exige `confirm: true` (solo el booleano `true` o la cadena "true"). Mismas salvedades que el reintento individual sobre el `eventId`. 409 si otro reintento concurrente tocó eventos de la tanda (no se reencola nada). Devuelve cuántos reencoló y cuántos FAILED quedan; repetir el pedido sigue con la tanda siguiente. Con el receptor todavía caído los eventos vuelven a FAILED tras 5 intentos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado del lote',
    type: RetryFailedOutboxResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Falta `confirm: true` o `limit` fuera de 1..100',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Otro reintento concurrente tocó eventos de la tanda; no se reencoló nada',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async retryFailed(
    @Body() dto: RetryFailedOutboxDto,
    @CurrentUser('userId') userId: string,
  ): Promise<RetryFailedOutboxResponseDto> {
    return this.outbox.retryFailed(dto, userId);
  }

  @Post(':id/retry')
  @Roles(...ROLES_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reintentar un evento FAILED',
    description:
      'Pasa un evento FAILED a PENDING con attempts = 0 para que el dispatcher lo reenvíe en la próxima barrida (cada 10 s). Queda auditado quién lo reencoló, cuándo y con qué intentos y error previos. Republica con el mismo `eventId`: los módulos receptores deduplican por él, pero el Core de M9 puede no redistribuir un `eventId` ya registrado, así que si el motivo del FAILED fue un payload rechazado el reintento no lo arregla. Un evento PENDING o SENT no se reenvía: 409.',
  })
  @ApiParam({ name: 'id', description: 'Id del evento del outbox', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Evento reencolado', type: OutboxEventResponseDto })
  @ApiResponse({ status: 400, description: 'El id no es un UUID', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'No existe ese evento', type: ErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'El evento no está en FAILED (ya salió o está en cola)',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async retry(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<OutboxEventResponseDto> {
    return this.outbox.retry(id, userId);
  }
}
