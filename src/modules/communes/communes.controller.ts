import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommunesService } from './communes.service';
import { CommuneResponseDto, QueryCommunesDto } from './dto';
import { ErrorResponseDto } from '../../common/dto';

@ApiTags('communes')
@ApiBearerAuth('JWT-auth')
@Controller('communes')
export class CommunesController {
  constructor(private readonly communesService: CommunesService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar las comunas con sus zonas y barrios',
    description:
      'Devuelve cada comuna (agrupación de barrios de M9) con las zonas operativas que agrupa y los barrios de cada zona, para armar selectores y mapas. Sin paginar: son 15 comunas, igual que el catálogo de barrios.',
  })
  @ApiResponse({
    status: 200,
    description: 'Comunas con sus zonas y barrios',
    type: CommuneResponseDto,
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
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  findAll(@Query() query: QueryCommunesDto): Promise<CommuneResponseDto[]> {
    return this.communesService.findAll(query);
  }
}
