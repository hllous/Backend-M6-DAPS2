import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import {
  AssignCrewDto,
  CollectionRecordResponseDto,
  CompleteServiceDto,
  ConfirmRescheduleDto,
  CreateCollectionRecordDto,
  CreateServiceDto,
  CreateZoneResultDto,
  QueryServicesDto,
  ServiceResponseDto,
  StatusChangeDto,
  UpdateServiceDto,
  ZoneResultResponseDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';
import { CurrentUser } from '../../common/decorators';

const AUTH = { status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto };
const FORBIDDEN = {
  status: 403,
  description: 'Sin permisos sobre servicios urbanos',
  type: ErrorResponseDto,
};
const SERVER = { status: 500, description: 'Error interno del servidor', type: ErrorResponseDto };
const NOT_FOUND = { status: 404, description: 'Servicio no encontrado', type: ErrorResponseDto };

@ApiTags('services')
@ApiBearerAuth('JWT-auth')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // ─── Programación ─────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Programar un servicio urbano',
    description:
      'Agenda una unidad de trabajo: recolección, barrido, lavado, vaciado de contenedor, poda o riego. El modo de ejecución se copia del tipo de servicio, no se elige acá. Un servicio ROUTE exige recorrido y copia sus zonas como snapshot —editar el recorrido después no altera lo ya programado—; un servicio POINT se ubica por el bien del inventario sobre el que se ejecuta, o por una zona suelta. Nace en estado SCHEDULED.',
  })
  @ApiResponse({ status: 201, description: 'Servicio programado', type: ServiceResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos: falta routeId en un ROUTE, falta objetivo o zona en un POINT, recorrido sin paradas, ticketId inconsistente con el origen, ventana horaria invertida, o recurso dado de baja',
    type: ErrorResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse({
    status: 404,
    description:
      'El tipo de servicio, el recorrido, el objetivo, la cuadrilla o el vehículo no existe',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  async create(
    @Body() dto: CreateServiceDto,
    @CurrentUser('userId') userId: string,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.create(dto, userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar servicios',
    description:
      'Listado paginado. Filtros por estado, tipo, modo, origen, cuadrilla, vehículo, zona cubierta, reclamo de M2 y rango de fechas agendadas.',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado de servicios' })
  @ApiResponse(AUTH)
  @ApiResponse(SERVER)
  async findAll(@Query() query: QueryServicesDto) {
    return this.servicesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un servicio por ID',
    description:
      'Detalle completo, con las zonas cubiertas, el resultado informado por zona y los registros de recolección.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Servicio encontrado', type: ServiceResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse(SERVER)
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ServiceResponseDto> {
    return this.servicesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Corregir la programación de un servicio',
    description:
      'Actualiza vehículo, ventana horaria y notas, solo mientras el servicio no arrancó. El tipo, el modo, el recorrido, el objetivo y las zonas quedan fijos al programar. La fecha se mueve con reschedule y confirm-reschedule, que dejan rastro del motivo.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Servicio actualizado', type: ServiceResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos', type: ErrorResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse({
    status: 404,
    description: 'Servicio o vehículo no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'El servicio ya arrancó o cerró y no admite edición',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.update(id, dto);
  }

  @Post(':id/assign-crew')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Asignar cuadrilla a un servicio',
    description:
      'La cuadrilla es opcional al programar y obligatoria para iniciar. Permite asignar el vehículo en la misma operación.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cuadrilla asignada', type: ServiceResponseDto })
  @ApiResponse({
    status: 400,
    description: 'La cuadrilla o el vehículo están dados de baja',
    type: ErrorResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse({
    status: 404,
    description: 'Servicio, cuadrilla o vehículo no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'El servicio ya arrancó o cerró',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  async assignCrew(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignCrewDto,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.assignCrew(id, dto);
  }

  // ─── Ejecución ────────────────────────────────────

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar la ejecución',
    description:
      'SCHEDULED → IN_PROGRESS. Requiere cuadrilla asignada, y vehículo si el tipo de servicio lo exige.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Servicio iniciado', type: ServiceResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({
    status: 409,
    description: 'Transición inválida, o falta la cuadrilla o el vehículo obligatorio',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  async start(@Param('id', ParseUUIDPipe) id: string): Promise<ServiceResponseDto> {
    return this.servicesService.start(id);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suspender la ejecución',
    description: 'IN_PROGRESS → SUSPENDED. El motivo queda registrado en statusReason.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Servicio suspendido', type: ServiceResponseDto })
  @ApiResponse({ status: 400, description: 'Falta el motivo', type: ErrorResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({ status: 409, description: 'Transición inválida', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusChangeDto,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.suspend(id, dto.reason);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reanudar la ejecución',
    description: 'SUSPENDED → IN_PROGRESS. Limpia el motivo de la suspensión.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Servicio reanudado', type: ServiceResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({ status: 409, description: 'Transición inválida', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async resume(@Param('id', ParseUUIDPipe) id: string): Promise<ServiceResponseDto> {
    return this.servicesService.resume(id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar el servicio',
    description:
      'IN_PROGRESS → COMPLETED o PARTIALLY_COMPLETED. El estado final no se elige: se calcula a partir de los resultados por zona. Si alguna zona quedó NOT_SERVICED o PARTIAL, el cierre es parcial. Todas las zonas del servicio tienen que tener resultado informado. Si el servicio actúa sobre un contenedor y cierra COMPLETED, **el contenedor transiciona en la misma operación**: OVERFLOWED o UNDER_REPAIR vuelven a ACTIVE sin datos extra, y RELOCATING vuelve a ACTIVE exigiendo `containerLocation` en el body. Las dos escrituras son atómicas. Un cierre parcial no transiciona el contenedor: el trabajo no se hizo.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Servicio cerrado', type: ServiceResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({
    status: 400,
    description:
      'El contenedor que atiende el servicio está en RELOCATING y no vino containerLocation',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Transición inválida, o faltan resultados de alguna zona',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteServiceDto,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.complete(id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancelar el servicio',
    description: 'SCHEDULED o SUSPENDED → CANCELLED. El motivo queda registrado.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Servicio cancelado', type: ServiceResponseDto })
  @ApiResponse({ status: 400, description: 'Falta el motivo', type: ErrorResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({ status: 409, description: 'Transición inválida', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusChangeDto,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.cancel(id, dto.reason);
  }

  @Post(':id/reschedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar el servicio para reprogramar',
    description:
      'SCHEDULED → RESCHEDULED. Deja el servicio a la espera de fecha nueva, con el motivo registrado. Es el estado en el que caen los servicios ante una alerta meteorológica o el rechazo de un corte de calle. La fecha se fija con confirm-reschedule.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Servicio marcado para reprogramar',
    type: ServiceResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Falta el motivo', type: ErrorResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({ status: 409, description: 'Transición inválida', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusChangeDto,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.reschedule(id, dto.reason);
  }

  @Post(':id/confirm-reschedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmar la nueva fecha',
    description: 'RESCHEDULED → SCHEDULED con la fecha y la ventana horaria nuevas.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Servicio reprogramado', type: ServiceResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Fecha inválida o ventana horaria invertida',
    type: ErrorResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({ status: 409, description: 'Transición inválida', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async confirmReschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmRescheduleDto,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.confirmReschedule(id, dto);
  }

  // ─── Resultado por zona ───────────────────────────

  @Post(':id/zone-results')
  @ApiOperation({
    summary: 'Informar el resultado de una zona',
    description:
      'Registra cómo quedó una zona del servicio. Solo con el servicio en IN_PROGRESS, una vez por zona, y sobre una zona que forme parte del servicio. El motivo es obligatorio si la zona no quedó SERVICED: es lo que alimenta el ranking de zonas no atendidas del tablero.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Resultado registrado', type: ZoneResultResponseDto })
  @ApiResponse({
    status: 400,
    description: 'La zona no pertenece al servicio, o el motivo falta o sobra según el status',
    type: ErrorResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({
    status: 409,
    description: 'El servicio no está en IN_PROGRESS, o la zona ya tiene resultado',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  async addZoneResult(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateZoneResultDto,
  ): Promise<ZoneResultResponseDto> {
    return this.servicesService.addZoneResult(id, dto);
  }

  @Get(':id/zone-results')
  @ApiOperation({
    summary: 'Listar los resultados por zona',
    description: 'Resultados informados para el servicio, en orden de registro.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Resultados del servicio',
    type: [ZoneResultResponseDto],
  })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse(SERVER)
  async findZoneResults(@Param('id', ParseUUIDPipe) id: string): Promise<ZoneResultResponseDto[]> {
    return this.servicesService.findZoneResults(id);
  }

  // ─── Registro de recolección ──────────────────────

  @Post(':id/collection-records')
  @ApiOperation({
    summary: 'Registrar residuos recolectados',
    description:
      'Volumen, peso, tipo de residuo y destino final. Es lo que alimenta los indicadores de toneladas y de desvío a reciclaje. Solo sobre servicios iniciados o cerrados, y contra un sitio de disposición activo.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'Registro creado',
    type: CollectionRecordResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'El sitio de disposición está dado de baja, o el resultado de zona no es de este servicio',
    type: ErrorResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse({
    status: 404,
    description: 'Servicio o sitio de disposición no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'El servicio todavía no arrancó',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  async addCollectionRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCollectionRecordDto,
  ): Promise<CollectionRecordResponseDto> {
    return this.servicesService.addCollectionRecord(id, dto);
  }

  @Get(':id/collection-records')
  @ApiOperation({
    summary: 'Listar los registros de recolección',
    description: 'Residuos registrados para el servicio, con volumen, peso y destino final.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Registros del servicio',
    type: [CollectionRecordResponseDto],
  })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse(SERVER)
  async findCollectionRecords(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CollectionRecordResponseDto[]> {
    return this.servicesService.findCollectionRecords(id);
  }
}
