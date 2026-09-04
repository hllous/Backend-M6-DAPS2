import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { CitizenPortalService } from './citizen-portal.service';
import {
  PublicReportResponseDto,
  PublicZoneResponseDto,
  QueryPublicGreenPointsDto,
  QueryPublicServicesDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';
import { SEGUIMIENTO } from './rate-limits';

/**
 * Los únicos endpoints del módulo que se sirven sin JWT.
 *
 * `@Public()` va endpoint por endpoint y no a nivel de clase a propósito: el
 * `JwtAuthGuard` global hace que todo endpoint nuevo nazca protegido, y abrir
 * la clase entera haría que el próximo `@Get` de acá salga público sin que
 * nadie lo decida.
 *
 * El límite de tasa sí va a nivel de clase, y por el mismo razonamiento al
 * revés: al no exigir token, esta es la única superficie que cualquiera en
 * internet puede pegar, así que un endpoint nuevo tiene que nacer limitado.
 */
@ApiTags('citizen-portal')
@UseGuards(ThrottlerGuard)
@Controller('public')
export class CitizenPortalController {
  constructor(private readonly citizenPortalService: CitizenPortalService) {}

  @Get('reports/:ticketId')
  @Public()
  @Throttle({ default: { limit: SEGUIMIENTO.limit, ttl: SEGUIMIENTO.ttl } })
  @ApiOperation({
    summary: 'Seguir una denuncia ambiental por número de reclamo',
    description:
      'Estado del trámite para el vecino, buscado por el número de reclamo de Atención Ciudadana (M2), que es el único identificador que él tiene. Devuelve la etapa del trámite, no el estado interno del expediente, y nunca la identidad del inspector, los hallazgos, el checklist ni el contenido del acta.',
  })
  @ApiParam({
    name: 'ticketId',
    description: 'Número de reclamo de M2',
    example: 'TCK-2026-004512',
  })
  @ApiResponse({ status: 200, description: 'Estado del trámite', type: PublicReportResponseDto })
  @ApiResponse({
    status: 404,
    description: 'No hay una denuncia ambiental para ese reclamo',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 429,
    description: 'Demasiadas consultas desde la misma dirección',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findReport(@Param('ticketId') ticketId: string): Promise<PublicReportResponseDto> {
    return this.citizenPortalService.findReportByTicket(ticketId);
  }

  @Get('services')
  @Public()
  @ApiOperation({
    summary: 'Consultar cuándo pasa el servicio',
    description:
      'Listado paginado de servicios programados, por zona y tipo. Sin `from` ni `to` devuelve los próximos 30 días. No expone cuadrilla, vehículo, notas ni el motivo interno de una reprogramación.',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado de servicios programados' })
  @ApiResponse({
    status: 429,
    description: 'Demasiadas consultas desde la misma dirección',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findServices(@Query() query: QueryPublicServicesDto) {
    return this.citizenPortalService.findServices(query);
  }

  @Get('green-points')
  @Public()
  @ApiOperation({
    summary: 'Consultar puntos verdes',
    description:
      'Listado paginado de puntos verdes activos, con su ubicación y qué tipos de residuo recibe cada uno.',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado de puntos verdes' })
  @ApiResponse({
    status: 429,
    description: 'Demasiadas consultas desde la misma dirección',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findGreenPoints(@Query() query: QueryPublicGreenPointsDto) {
    return this.citizenPortalService.findGreenPoints(query);
  }

  @Get('zones')
  @Public()
  @ApiOperation({
    summary: 'Listar zonas operativas',
    description:
      'Las zonas activas, para poder ofrecer el filtro de los otros dos listados. Sin paginar: son pocas y el frontend las carga una vez.',
  })
  @ApiResponse({ status: 200, description: 'Zonas activas', type: [PublicZoneResponseDto] })
  @ApiResponse({
    status: 429,
    description: 'Demasiadas consultas desde la misma dirección',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findZones(): Promise<PublicZoneResponseDto[]> {
    return this.citizenPortalService.findZones();
  }
}
