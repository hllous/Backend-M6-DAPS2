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
import { OutboundRequestsService } from './outbound-requests.service';
import {
  ApproveClosureDto,
  CreateRepairRequestDto,
  CreateStreetClosureRequestDto,
  QueryRepairRequestsDto,
  QueryStreetClosureRequestsDto,
  RejectClosureDto,
  RepairRequestResponseDto,
  StartRepairDto,
  StreetClosureRequestResponseDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';

const AUTH = { status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto };
const FORBIDDEN = {
  status: 403,
  description: 'Sin permisos sobre derivaciones',
  type: ErrorResponseDto,
};
const SERVER = { status: 500, description: 'Error interno del servidor', type: ErrorResponseDto };

@ApiTags('repair-requests')
@ApiBearerAuth('JWT-auth')
@Controller('repair-requests')
export class RepairRequestsController {
  constructor(private readonly service: OutboundRequestsService) {}

  @Post()
  @ApiOperation({
    summary: 'Solicitar una reparación a Obras Públicas',
    description:
      'Registra un daño de infraestructura que detectamos pero que no nos corresponde arreglar —pavimento roto, vereda hundida, luminaria caída, sumidero tapado— y publica infrastructureRepairRequested hacia M3. La solicitud existe para poder seguir el pedido: la respuesta de M3 vuelve asincrónica y hay que saber a qué solicitud contesta. Si el daño salió de un servicio nacido de un reclamo, el ticketId viaja en el evento.',
  })
  @ApiResponse({
    status: 201,
    description: 'Solicitud creada y derivada a M3',
    type: RepairRequestResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos', type: ErrorResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse(SERVER)
  async create(@Body() dto: CreateRepairRequestDto): Promise<RepairRequestResponseDto> {
    return this.service.createRepairRequest(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar solicitudes de reparación',
    description: 'Listado paginado. Filtros por estado, tipo de daño, gravedad y origen.',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado' })
  @ApiResponse(AUTH)
  @ApiResponse(SERVER)
  async findAll(@Query() query: QueryRepairRequestsDto) {
    return this.service.findRepairRequests(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una solicitud de reparación',
    description: 'Detalle con su estado y la orden de trabajo de M3, si la informaron.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la solicitud', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Solicitud encontrada', type: RepairRequestResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<RepairRequestResponseDto> {
    return this.service.findRepairRequest(id);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar la reparación como en curso',
    description:
      'Pasa a IN_PROGRESS y registra la orden de trabajo de M3. **Normalmente lo dispara el evento workOrderScheduled de M3** (Fase 6); este endpoint existe para operación manual y para poder demostrar el circuito mientras no haya bus.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la solicitud', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Solicitud en curso', type: RepairRequestResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async start(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartRepairDto,
  ): Promise<RepairRequestResponseDto> {
    return this.service.startRepair(id, dto);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar la solicitud de reparación',
    description:
      'Pasa a CLOSED. **Normalmente lo dispara workOrderCompleted de M3** (Fase 6). Tres estados, no una máquina: pedida, en curso, cerrada — por eso no consumimos workOrderUpdated.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la solicitud', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Solicitud cerrada', type: RepairRequestResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async close(@Param('id', ParseUUIDPipe) id: string): Promise<RepairRequestResponseDto> {
    return this.service.closeRepair(id);
  }
}

@ApiTags('street-closure-requests')
@ApiBearerAuth('JWT-auth')
@Controller('street-closure-requests')
export class StreetClosureRequestsController {
  constructor(private readonly service: OutboundRequestsService) {}

  @Post()
  @ApiOperation({
    summary: 'Solicitar un corte de calle a Tránsito',
    description:
      'Registra el corte que necesita un servicio o una poda y publica streetClosureRequested hacia M7, en el esquema unificado con la solicitud de M3. El sourceRef apunta al Service o a la TreeIntervention que lo origina: es lo que hace que la respuesta de M7 se pueda aplicar sobre el trabajo correcto. Exige al menos un tramo, porque affectedSections no puede viajar vacío.',
  })
  @ApiResponse({
    status: 201,
    description: 'Solicitud creada y derivada a M7',
    type: StreetClosureRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos, o la solicitud no tiene tramos',
    type: ErrorResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse(SERVER)
  async create(
    @Body() dto: CreateStreetClosureRequestDto,
  ): Promise<StreetClosureRequestResponseDto> {
    return this.service.createClosureRequest(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar solicitudes de corte',
    description: 'Listado paginado. Filtros por estado y por el trabajo que las origina.',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado' })
  @ApiResponse(AUTH)
  @ApiResponse(SERVER)
  async findAll(@Query() query: QueryStreetClosureRequestsDto) {
    return this.service.findClosureRequests(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una solicitud de corte',
    description:
      'Detalle con sus tramos y el identificador de corte que asignó M7, si respondieron.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la solicitud', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Solicitud encontrada',
    type: StreetClosureRequestResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<StreetClosureRequestResponseDto> {
    return this.service.findClosureRequest(id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registrar la aprobación del corte',
    description:
      'Pasa a APPROVED y guarda el identificador de corte de M7, que habilita la ejecución del servicio bloqueado. **Normalmente lo dispara streetClosureApproved** (Fase 6); este endpoint existe para operación manual y para demostrarlo sin bus.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la solicitud', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Corte aprobado',
    type: StreetClosureRequestResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveClosureDto,
  ): Promise<StreetClosureRequestResponseDto> {
    return this.service.approveClosure(id, dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registrar el rechazo del corte',
    description:
      'Pasa a REJECTED. El servicio dependiente se reprograma o se cancela. **Normalmente lo dispara streetClosureRejected** (Fase 6).',
  })
  @ApiParam({ name: 'id', description: 'UUID de la solicitud', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Corte rechazado',
    type: StreetClosureRequestResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Falta el motivo', type: ErrorResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectClosureDto,
  ): Promise<StreetClosureRequestResponseDto> {
    return this.service.rejectClosure(id, dto.reason);
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registrar el fin del corte',
    description:
      'Pasa a ENDED y libera la dependencia. **Normalmente lo dispara streetClosureEnded** (Fase 6), que desde el 30/08 ya trae el closureRequestId para poder correlacionarlo.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la solicitud', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Corte finalizado',
    type: StreetClosureRequestResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async end(@Param('id', ParseUUIDPipe) id: string): Promise<StreetClosureRequestResponseDto> {
    return this.service.endClosure(id);
  }
}
