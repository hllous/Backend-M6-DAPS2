import { Idempotent } from '../../common/idempotency/idempotent.decorator';
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
import {
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ServicesService } from './services.service';
import {
  AssignCrewDto,
  AssignmentConflictsResponseDto,
  CreateDelayNoticeDto,
  DelayNoticeResponseDto,
  QueryAssignmentConflictsDto,
  CollectionRecordResponseDto,
  CompleteServiceDto,
  ConfirmRescheduleDto,
  CreateCollectionRecordDto,
  CreateServiceDto,
  CreateZoneResultDto,
  QueryServicesDto,
  ServiceResponseDto,
  StatusChangeDto,
  SuspendServiceDto,
  UpdateServiceDto,
  ZoneResultResponseDto,
} from './dto';
import { AuthenticatedUser } from '../../auth/jwt.strategy';
import { ErrorResponseDto } from '../../common/dto';
import { ApiNotAssigned, ApiPaginatedResponse, CurrentUser, Roles } from '../../common/decorators';
import { ROLES_CUADRILLA, ROLES_OPERACIONES } from '../../auth/role-groups';
import { ApiAnyM6Role } from '../../common/decorators/roles.decorator';

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
  @Roles(...ROLES_OPERACIONES)
  @ApiBody({
    type: CreateServiceDto,
    examples: {
      ejemplo: {
        summary: 'Recolección planificada de un recorrido',
        value: {
          serviceTypeId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          scheduledDate: '2027-03-15',
          origin: 'PLANNED',
          routeId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          crewId: 'e5f6a7b8-c9d0-4234-8fab-345678901234',
          vehicleId: 'f6a7b8c9-d0e1-4345-8abc-456789012345',
          windowFrom: '08:00',
          windowTo: '12:00',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Programar un servicio urbano',
    description:
      'Agenda una unidad de trabajo: recolección, barrido, lavado, vaciado de contenedor, poda o riego. El modo de ejecución se copia del tipo de servicio, no se elige acá. Un servicio ROUTE exige recorrido y copia sus zonas como snapshot —editar el recorrido después no altera lo ya programado—; un servicio POINT se ubica por el bien del inventario sobre el que se ejecuta, o por una zona suelta. Nace en estado SCHEDULED.',
  })
  @ApiResponse({ status: 201, description: 'Servicio programado', type: ServiceResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos: falta routeId en un ROUTE, falta objetivo o zona en un POINT, recorrido sin paradas, ticketId inconsistente con el origen, inspectionId sin origin = INSPECTION o weatherAlertId sin origin = WEATHER_ALERT, inspectionId con un tipo de servicio que no es POINT, ventana horaria invertida, o recurso dado de baja',
    type: ErrorResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse({
    status: 404,
    description:
      'El tipo de servicio, el recorrido, el objetivo, la cuadrilla, el vehículo o la inspección (inspectionId) no existe',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'La cuadrilla o el vehículo ya están tomados ese día en una franja que se pisa, o la cuadrilla no es de la zona o la especialidad del servicio, y falta `overrideNote`; o la inspección de `inspectionId` ya tiene un servicio asignado o ya fue cerrada',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  @Idempotent()
  async create(
    @Body() dto: CreateServiceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.create(dto, actor);
  }

  @ApiAnyM6Role()
  @Get()
  @ApiOperation({
    summary: 'Listar servicios',
    description:
      'Listado paginado. Filtros por estado, tipo, modo, origen, cuadrilla, vehículo, zona cubierta, bien objetivo (targetType/targetId, p. ej. los servicios de un árbol), reclamo de M2 y rango de fechas agendadas.',
  })
  @ApiPaginatedResponse(ServiceResponseDto, 'Listado paginado de servicios')
  @ApiResponse({
    status: 400,
    description:
      'Filtros inválidos: scheduledFrom posterior a scheduledTo, valor fuera del catálogo o id que no es UUID',
    type: ErrorResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(SERVER)
  async findAll(@Query() query: QueryServicesDto) {
    return this.servicesService.findAll(query);
  }

  @ApiAnyM6Role()
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
  @Roles(...ROLES_OPERACIONES)
  @ApiOperation({
    summary: 'Corregir la programación de un servicio',
    description:
      'Actualiza vehículo, ventana horaria y notas, solo mientras el servicio no arrancó. Si el cambio de vehículo o ventana lo solapa con otro servicio de la misma cuadrilla o vehículo ese día, avisa con 409 y hace falta `overrideNote` (10 a 500 caracteres), igual que en assign-crew. El tipo, el modo, el recorrido, el objetivo y las zonas quedan fijos al programar. La fecha se mueve con reschedule y confirm-reschedule, que dejan rastro del motivo.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Servicio actualizado', type: ServiceResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos', type: ErrorResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse({
    status: 404,
    description: 'Servicio o vehículo no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'El servicio ya arrancó o cerró y no admite edición, o el vehículo o la ventana nuevos se solapan con otro servicio de la misma cuadrilla o vehículo y falta `overrideNote`',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.update(id, dto, actor);
  }

  @Post(':id/assign-crew')
  @Roles(...ROLES_OPERACIONES)
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: AssignCrewDto,
    examples: {
      ejemplo: {
        summary: 'Asignar cuadrilla y vehículo',
        value: {
          crewId: 'e5f6a7b8-c9d0-4234-8fab-345678901234',
          vehicleId: 'f6a7b8c9-d0e1-4345-8abc-456789012345',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Asignar cuadrilla a un servicio',
    description:
      'La cuadrilla es opcional al programar y obligatoria para iniciar. Permite asignar el vehículo en la misma operación. Avisa, sin bloquear, si la cuadrilla no es la de la zona del servicio o su especialidad no corresponde al tipo de servicio: igual que un solapamiento, exige `overrideNote`.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cuadrilla asignada', type: ServiceResponseDto })
  @ApiResponse({
    status: 400,
    description: 'La cuadrilla o el vehículo están dados de baja',
    type: ErrorResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse({
    status: 404,
    description: 'Servicio, cuadrilla o vehículo no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'El servicio ya arrancó o cerró, o hay solapamiento (o la cuadrilla no es de la zona o la especialidad del servicio) y falta `overrideNote`. ' +
      'Nada de eso bloquea: con la nota, la asignación se hace igual.',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  async assignCrew(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignCrewDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.assignCrew(id, dto, actor);
  }

  @Get(':id/assignment-conflicts')
  @ApiOperation({
    summary: 'Con qué se solapa asignar estos recursos',
    description:
      'Los servicios del mismo día cuya franja horaria se pisa con la de este y que ya tienen tomada la cuadrilla o el vehículo. ' +
      'Existe para poder **avisar antes de enviar**: sin esta consulta, el planificador se enteraría por un 409. ' +
      'Sin `crewId` ni `vehicleId` evalúa los que el servicio ya tiene asignados. ' +
      'Una franja horaria ausente se trata como todo el día. ' +
      'Además informa en `warnings` si la cuadrilla no trabaja en la zona del servicio ese día o su especialidad no corresponde al tipo de servicio; esos avisos también exigen `overrideNote`.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Solapamientos encontrados',
    type: AssignmentConflictsResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse({
    status: 404,
    description: 'Servicio, cuadrilla o vehículo no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  async assignmentConflicts(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryAssignmentConflictsDto,
  ): Promise<AssignmentConflictsResponseDto> {
    return this.servicesService.getAssignmentConflicts(id, query);
  }

  // ─── Aviso de demora ──────────────────────────────

  @Post(':id/delay-notices')
  @ApiNotAssigned('la cuadrilla del servicio')
  @Roles(...ROLES_CUADRILLA)
  @ApiBody({
    type: CreateDelayNoticeDto,
    examples: {
      ejemplo: {
        summary: 'Demora de 90 minutos antes de arrancar',
        value: {
          delayType: 'START',
          delayMinutes: 90,
          reason: 'Corte de calle imprevisto por rotura de un caño',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Avisar que el servicio se demora',
    description:
      '**No cambia el estado del servicio.** `DELAYED` no es un estado: el servicio sigue en `SCHEDULED` o `IN_PROGRESS` mientras se demora. ' +
      'El tipo tiene que coincidir con el momento — `START` antes de arrancar, `DURATION` con la cuadrilla trabajando. ' +
      'Un aviso nuevo reemplaza al vigente; el anterior queda en el historial y no se borra. ' +
      'Si el servicio nació de un reclamo y ya arrancó (`IN_PROGRESS`), sale hacia M2 como `updateTicketStatus / PROGRESS`: el motivo viaja como mensaje interno, no se le muestra al vecino. Una demora en `SCHEDULED` no se proyecta, porque M2 solo acepta `PROGRESS` con el ticket en gestión.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Aviso registrado', type: DelayNoticeResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'El tipo de demora no corresponde al estado del servicio, o los datos son inválidos',
    type: ErrorResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({
    status: 409,
    description: 'El servicio no está en SCHEDULED ni en IN_PROGRESS',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  @Idempotent()
  async addDelayNotice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDelayNoticeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<DelayNoticeResponseDto> {
    return this.servicesService.addDelayNotice(id, dto, actor.userId, actor.actorId);
  }

  @ApiAnyM6Role()
  @Get(':id/delay-notices')
  @ApiOperation({
    summary: 'Historial de avisos de demora',
    description:
      'Del más reciente al más viejo. El vigente es el que tiene `active: true`; los demás fueron reemplazados por uno posterior.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Avisos del servicio',
    type: DelayNoticeResponseDto,
    isArray: true,
  })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse(SERVER)
  async findDelayNotices(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DelayNoticeResponseDto[]> {
    return this.servicesService.findDelayNotices(id);
  }

  // ─── Ejecución ────────────────────────────────────

  @Post(':id/start')
  @ApiNotAssigned('la cuadrilla del servicio')
  @Roles(...ROLES_CUADRILLA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar la ejecución',
    description:
      'SCHEDULED → IN_PROGRESS. Solo la cuadrilla del servicio (integrante o líder); un servicio sin cuadrilla da 403 NOT_ASSIGNED. Exige vehículo si el tipo de servicio lo pide.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Servicio iniciado', type: ServiceResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({
    status: 409,
    description: 'Transición inválida, o falta el vehículo obligatorio',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  async start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.start(id, actor);
  }

  @Post(':id/suspend')
  @ApiNotAssigned('la cuadrilla del servicio')
  @Roles(...ROLES_CUADRILLA)
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: SuspendServiceDto,
    examples: {
      ejemplo: {
        summary: 'Suspensión por falla del camión',
        value: {
          reason: 'Falla mecánica del vehículo',
          note: 'El camión 12 se quedó sin frenos; esperan reemplazo',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Suspender la ejecución',
    description:
      'IN_PROGRESS → SUSPENDED. El motivo queda en statusReason; la nota opcional, en statusNote.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Servicio suspendido', type: ServiceResponseDto })
  @ApiResponse({ status: 400, description: 'Falta el motivo', type: ErrorResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({ status: 409, description: 'Transición inválida', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendServiceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.suspend(id, actor, dto.reason, dto.note);
  }

  @Post(':id/resume')
  @ApiNotAssigned('la cuadrilla del servicio')
  @Roles(...ROLES_CUADRILLA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reanudar la ejecución',
    description:
      'SUSPENDED → IN_PROGRESS. Limpia el motivo y la nota de la suspensión (statusNote solo vive mientras el servicio está SUSPENDED).',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Servicio reanudado', type: ServiceResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({ status: 409, description: 'Transición inválida', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async resume(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.resume(id, actor);
  }

  @Post(':id/complete')
  @ApiNotAssigned('la cuadrilla del servicio')
  @Roles(...ROLES_CUADRILLA)
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: CompleteServiceDto,
    examples: {
      ejemplo: {
        summary: 'Cierre sin datos extra',
        value: {},
      },
    },
  })
  @ApiOperation({
    summary: 'Cerrar el servicio',
    description:
      'IN_PROGRESS → COMPLETED o PARTIALLY_COMPLETED. El estado final no se elige: se calcula a partir de los resultados por zona. Si alguna zona quedó NOT_SERVICED o PARTIAL, el cierre es parcial. Todas las zonas del servicio tienen que tener resultado informado. Si el servicio actúa sobre un contenedor y cierra COMPLETED, **el contenedor transiciona en la misma operación**: OVERFLOWED o UNDER_REPAIR vuelven a ACTIVE sin datos extra, y RELOCATING vuelve a ACTIVE exigiendo `containerLocation` en el body. Las dos escrituras son atómicas. Un cierre parcial no transiciona el contenedor: el trabajo no se hizo.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Servicio cerrado', type: ServiceResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({
    status: 400,
    description:
      'El contenedor que atiende el servicio está en RELOCATING y no vino containerLocation',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'Transición inválida, faltan resultados de alguna zona, o el servicio o su contenedor cambiaron de estado durante el cierre',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteServiceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.complete(id, dto, actor);
  }

  @Post(':id/cancel')
  @Roles(...ROLES_OPERACIONES)
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: StatusChangeDto,
    examples: {
      ejemplo: {
        summary: 'Cancelación por alerta meteorológica',
        value: { reason: 'Alerta meteorológica: tormenta fuerte en la zona' },
      },
    },
  })
  @ApiOperation({
    summary: 'Cancelar el servicio',
    description:
      'SCHEDULED, RESCHEDULED o SUSPENDED → CANCELLED. El motivo queda registrado. ' +
      'Un servicio RESCHEDULED se cancela directo: no hace falta confirmar antes una fecha ' +
      'nueva. IN_PROGRESS no se cancela — hay que suspenderlo o cerrarlo. ' +
      'Solo acepta reason: enviar note da 400 (la nota existe solo en suspend) y limpia statusNote.',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Servicio cancelado', type: ServiceResponseDto })
  @ApiResponse({ status: 400, description: 'Falta el motivo', type: ErrorResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({ status: 409, description: 'Transición inválida', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusChangeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.cancel(id, dto.reason, actor);
  }

  @Post(':id/reschedule')
  @Roles(...ROLES_OPERACIONES)
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: StatusChangeDto,
    examples: {
      ejemplo: {
        summary: 'Marcar para reprogramar por clima',
        value: { reason: 'Alerta meteorológica: tormenta fuerte en la zona' },
      },
    },
  })
  @ApiOperation({
    summary: 'Marcar el servicio para reprogramar',
    description:
      'SCHEDULED → RESCHEDULED. Deja el servicio a la espera de fecha nueva, con el motivo registrado. Es el estado en el que caen los servicios ante una alerta meteorológica o el rechazo de un corte de calle. La fecha se fija con confirm-reschedule. Solo acepta reason: enviar note da 400 (la nota existe solo en suspend).',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Servicio marcado para reprogramar',
    type: ServiceResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Falta el motivo', type: ErrorResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({ status: 409, description: 'Transición inválida', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusChangeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.reschedule(id, dto.reason, actor);
  }

  @Post(':id/confirm-reschedule')
  @Roles(...ROLES_OPERACIONES)
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: ConfirmRescheduleDto,
    examples: {
      ejemplo: {
        summary: 'Nueva fecha y ventana',
        value: {
          scheduledDate: '2027-03-22',
          windowFrom: '07:00',
          windowTo: '11:00',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Confirmar la nueva fecha',
    description:
      'RESCHEDULED → SCHEDULED con la fecha y la ventana horaria nuevas. Si el servicio nació de un reclamo (ticketId), le informa la nueva fecha y franja a M2 como texto para el vecino, salvo que el ticket no admita el aviso (pendiente de información o terminado).',
  })
  @ApiParam({ name: 'id', description: 'UUID del servicio', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Servicio reprogramado', type: ServiceResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Fecha inválida o anterior a hoy, o ventana horaria invertida',
    type: ErrorResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({ status: 409, description: 'Transición inválida', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async confirmReschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmRescheduleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ServiceResponseDto> {
    return this.servicesService.confirmReschedule(id, dto, actor);
  }

  // ─── Resultado por zona ───────────────────────────

  @Post(':id/zone-results')
  @ApiNotAssigned('la cuadrilla del servicio')
  @Roles(...ROLES_CUADRILLA)
  @ApiBody({
    type: CreateZoneResultDto,
    examples: {
      ejemplo: {
        summary: 'Zona no atendida por acceso bloqueado',
        value: {
          zoneId: 'd4e5f6a7-b8c9-4123-8efa-234567890123',
          status: 'NOT_SERVICED',
          reason: 'BLOCKED_ACCESS',
          proposedDate: '2027-03-16',
          notes: 'Camión de mudanza bloqueando la cuadra entre Mitre y San Martín.',
        },
      },
    },
  })
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
  @ApiResponse(NOT_FOUND)
  @ApiResponse({
    status: 409,
    description: 'El servicio no está en IN_PROGRESS, o la zona ya tiene resultado',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  @Idempotent()
  async addZoneResult(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateZoneResultDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ZoneResultResponseDto> {
    return this.servicesService.addZoneResult(id, dto, actor.userId);
  }

  @ApiAnyM6Role()
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
  @ApiNotAssigned('la cuadrilla del servicio')
  @Roles(...ROLES_CUADRILLA)
  @ApiBody({
    type: CreateCollectionRecordDto,
    examples: {
      ejemplo: {
        summary: 'Residuos domiciliarios del recorrido',
        value: {
          wasteType: 'HOUSEHOLD',
          disposalSiteId: 'a7b8c9d0-e1f2-3456-abcd-567890123456',
          volumeM3: 12.5,
          weightKg: 3400.75,
        },
      },
    },
  })
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
  @Idempotent()
  async addCollectionRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCollectionRecordDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<CollectionRecordResponseDto> {
    return this.servicesService.addCollectionRecord(id, dto, actor.userId);
  }

  @ApiAnyM6Role()
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
