import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NeighborhoodsService } from './neighborhoods.service';
import { NeighborhoodResponseDto, QueryNeighborhoodsDto } from './dto';
import { ErrorResponseDto } from '../../common/dto';

@ApiTags('neighborhoods')
@ApiBearerAuth('JWT-auth')
@Controller('neighborhoods')
export class NeighborhoodsController {
  constructor(private readonly neighborhoodsService: NeighborhoodsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar los barrios del catálogo de M9',
    description:
      'Devuelve el catálogo de barrios de M9 que M6 mantiene en caché (se lee del Core al arrancar y se renueva cada 6 horas), para que el frontend arme selectores sin hablar con el Core. Los `id` son los que se mandan al asignar barrios a una zona. Sin paginar: son unas decenas de barrios.',
  })
  @ApiResponse({
    status: 200,
    description: 'Barrios del catálogo',
    type: NeighborhoodResponseDto,
    isArray: true,
  })
  @ApiResponse({
    status: 400,
    description: 'Parámetros de consulta inválidos',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'El catálogo todavía no se pudo leer del Core (sin CORE_API_URL o Core caído)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  findAll(@Query() query: QueryNeighborhoodsDto): NeighborhoodResponseDto[] {
    return this.neighborhoodsService.findAll(query);
  }
}
