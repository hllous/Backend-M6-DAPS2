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
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EnvironmentalReportsService } from './environmental-reports.service';
import {
  CreateEnvironmentalReportDto,
  EnvironmentalReportResponseDto,
  QueryEnvironmentalReportsDto,
  ReportStatusChangeDto,
  RequestInformationDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';
import { ApiETag, ETagInterceptor, IfMatch } from '../../common/etag';
import { AuthenticatedUser } from '../../auth/jwt.strategy';
import {
  ApiPaginatedResponse,
  CurrentUser,
  Roles,
  ApiBadRequestParams,
} from '../../common/decorators';
import { ROLES_AMBIENTAL, ROLES_EXPEDIENTE_ALTA } from '../../auth/role-groups';
import { ApiAnyM6Role } from '../../common/decorators/roles.decorator';

const AUTH = { status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto };
const NOT_FOUND = { status: 404, description: 'Expediente no encontrado', type: ErrorResponseDto };
const CONFLICT = { status: 409, description: 'Transición inválida', type: ErrorResponseDto };
const SERVER = { status: 500, description: 'Error interno del servidor', type: ErrorResponseDto };

@ApiTags('environmental-reports')
@ApiBearerAuth('JWT-auth')
@UseInterceptors(ETagInterceptor)
@Controller('environmental-reports')
export class EnvironmentalReportsController {
  constructor(private readonly reportsService: EnvironmentalReportsService) {}

  @Post()
  @Roles(...ROLES_EXPEDIENTE_ALTA)
  @ApiBody({
    type: CreateEnvironmentalReportDto,
    examples: {
      ejemplo: {
        summary: 'Basural a cielo abierto con reclamo de M2',
        value: {
          reportType: 'ILLEGAL_DUMPSITE',
          address: 'Camino de Cintura 4500',
          description: 'Acopio de escombros sobre la vereda, frente al número 4500.',
          lat: -34.7,
          lng: -58.5,
          ticketId: 'TCK-2026-004821',
          priority: 'HIGH',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Abrir un expediente ambiental',
    description:
      'Registra una denuncia ambiental —ruidos, vertidos, microbasurales, emisiones— y abre el expediente en estado RECEIVED. Puede nacer de un reclamo de M2 (con ticketId) o de una detección de oficio del inspector, que es el camino que no depende de ningún otro módulo.',
  })
  @ApiResponse({
    status: 201,
    description: 'Expediente abierto',
    type: EnvironmentalReportResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos, o un inspector (solo Campo) mandó ticketId: el alta con reclamo es de Oficina Ambiental',
    type: ErrorResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(SERVER)
  async create(
    @Body() dto: CreateEnvironmentalReportDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<EnvironmentalReportResponseDto> {
    return this.reportsService.create(dto, actor);
  }

  @ApiAnyM6Role()
  @Get()
  @ApiOperation({
    summary: 'Listar expedientes ambientales',
    description:
      'Listado paginado. Filtros por estado, tipo de denuncia, prioridad, reclamo de origen, cuadrilla (crewId: expedientes con alguna inspección cuyo servicio no cancelado tenga esa cuadrilla, filtrado en la base para que la página y meta.total sean consistentes) y búsqueda por dirección. Rango de fechas from/to (YYYY-MM-DD, inclusivo, día argentino) sobre la fecha de última actualización; meta.total refleja el filtro.',
  })
  @ApiPaginatedResponse(EnvironmentalReportResponseDto, 'Listado paginado de expedientes')
  @ApiResponse({
    status: 400,
    description:
      'Filtro inválido (por ejemplo, un status desconocido, crewId que no es UUID, fecha mal formada o from posterior a to)',
    type: ErrorResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(SERVER)
  async findAll(@Query() query: QueryEnvironmentalReportsDto) {
    return this.reportsService.findAll(query);
  }

  @ApiAnyM6Role()
  @Get(':id')
  @ApiETag()
  @ApiOperation({
    summary: 'Obtener un expediente por ID',
    description:
      'Detalle del expediente, con su estado, su plazo de vencimiento si lo tiene y la cuadrilla asignada a su inspección más reciente con servicio no cancelado (assignedCrewId).',
  })
  @ApiParam({ name: 'id', description: 'UUID del expediente', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Expediente encontrado',
    type: EnvironmentalReportResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse(SERVER)
  @ApiBadRequestParams()
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<EnvironmentalReportResponseDto> {
    return this.reportsService.findOne(id);
  }

  @Post(':id/start-review')
  @ApiETag({ ifMatch: true })
  @Roles(...ROLES_AMBIENTAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tomar el expediente para análisis',
    description: 'RECEIVED → UNDER_REVIEW. Si nació de un reclamo, se le avisa a M2.',
  })
  @ApiParam({ name: 'id', description: 'UUID del expediente', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Expediente en análisis',
    type: EnvironmentalReportResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse(CONFLICT)
  @ApiResponse(SERVER)
  async startReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @IfMatch() ifMatch?: string,
  ): Promise<EnvironmentalReportResponseDto> {
    return this.reportsService.startReview(id, actor, ifMatch);
  }

  @Post(':id/forward')
  @ApiETag({ ifMatch: true })
  @Roles(...ROLES_AMBIENTAL)
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: ReportStatusChangeDto,
    examples: {
      ejemplo: {
        summary: 'Derivación a otra área',
        value: { reason: 'El hecho denunciado corresponde a Obras Públicas, no a Ambiente.' },
      },
    },
  })
  @ApiOperation({
    summary: 'Derivar: no es de nuestra competencia',
    description:
      'UNDER_REVIEW → FORWARDED. Hacia M2 sale como RETURNED, no como REJECTED: devolver un reclamo que no es de nuestra área es distinto de desestimarlo.',
  })
  @ApiParam({ name: 'id', description: 'UUID del expediente', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Expediente derivado',
    type: EnvironmentalReportResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Falta el motivo', type: ErrorResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse(CONFLICT)
  @ApiResponse(SERVER)
  async forward(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportStatusChangeDto,
    @CurrentUser() actor: AuthenticatedUser,
    @IfMatch() ifMatch?: string,
  ): Promise<EnvironmentalReportResponseDto> {
    return this.reportsService.forward(id, dto.reason, actor, ifMatch);
  }

  @Post(':id/dismiss')
  @ApiETag({ ifMatch: true })
  @Roles(...ROLES_AMBIENTAL)
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: ReportStatusChangeDto,
    examples: {
      ejemplo: {
        summary: 'Desestimación de la denuncia',
        value: { reason: 'La denuncia duplica el expediente ya abierto para la misma dirección.' },
      },
    },
  })
  @ApiOperation({
    summary: 'Desestimar sin inspección',
    description: 'UNDER_REVIEW → DISMISSED. Hacia M2 sale como REJECTED.',
  })
  @ApiParam({ name: 'id', description: 'UUID del expediente', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Expediente desestimado',
    type: EnvironmentalReportResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Falta el motivo', type: ErrorResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse(CONFLICT)
  @ApiResponse(SERVER)
  async dismiss(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportStatusChangeDto,
    @CurrentUser() actor: AuthenticatedUser,
    @IfMatch() ifMatch?: string,
  ): Promise<EnvironmentalReportResponseDto> {
    return this.reportsService.dismiss(id, dto.reason, actor, ifMatch);
  }

  @Post(':id/request-information')
  @Roles(...ROLES_AMBIENTAL)
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: RequestInformationDto,
    examples: {
      ejemplo: {
        summary: 'Pedido de una foto adicional',
        value: {
          message: 'Necesitamos una foto más del frente del local, tomada de noche.',
          requiredBy: '2027-03-20',
          internalNote: 'La foto anterior salió movida.',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Pedirle información al vecino',
    description:
      'Durante la revisión (UNDER_REVIEW, con reclamo de M2) le pide al vecino algo más, por ejemplo una foto. Hacia M2 sale como INFORMATION_REQUIRED y el ticket pasa a PENDING_INFORMATION. El expediente sigue en UNDER_REVIEW con la solicitud pendiente (informationRequestPending) hasta que M2 avisa la respuesta, que queda en citizenResponse. Solo puede haber una solicitud pendiente por reclamo.',
  })
  @ApiParam({ name: 'id', description: 'UUID del expediente', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Solicitud registrada y enviada a M2',
    type: EnvironmentalReportResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Mensaje vacío o demasiado largo, o requiredBy inválido o en el pasado',
    type: ErrorResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({
    status: 409,
    description:
      'Expediente sin reclamo, fuera de UNDER_REVIEW, con una solicitud ya pendiente o con el ticket en un estado de M2 que no la admite',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  async requestInformation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestInformationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<EnvironmentalReportResponseDto> {
    return this.reportsService.requestInformation(id, dto, actor);
  }

  @Post(':id/close')
  @ApiETag({ ifMatch: true })
  @Roles(...ROLES_AMBIENTAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar el expediente',
    description:
      'Cierra desde FORWARDED, DISMISSED, NO_VIOLATION, SANCTIONED o NOTICE_ISSUED. El cierre por vencimiento del plazo de M4 lo hace el sistema solo, sin pasar por acá.',
  })
  @ApiParam({ name: 'id', description: 'UUID del expediente', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Expediente cerrado',
    type: EnvironmentalReportResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse(CONFLICT)
  @ApiResponse(SERVER)
  async close(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @IfMatch() ifMatch?: string,
  ): Promise<EnvironmentalReportResponseDto> {
    return this.reportsService.close(id, actor, ifMatch);
  }
}
