import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GreenSpacesService } from './green-spaces.service';
import {
  CreateGreenSpaceDto,
  UpdateGreenSpaceDto,
  GreenSpaceResponseDto,
  QueryGreenSpacesDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';

@ApiTags('green-spaces')
@ApiBearerAuth('JWT-auth')
@Controller('green-spaces')
export class GreenSpacesController {
  constructor(private readonly greenSpacesService: GreenSpacesService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un espacio verde',
    description:
      'Da de alta un espacio verde (plaza, parque, cantero, rambla o promenade) en una zona operativa. El riego y corte de césped se programan como servicios sobre el espacio.',
  })
  @ApiResponse({
    status: 201,
    description: 'Espacio verde registrado exitosamente',
    type: GreenSpaceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para registrar espacios verdes',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Zona referenciada no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async create(
    @Body() dto: CreateGreenSpaceDto,
  ): Promise<GreenSpaceResponseDto> {
    return this.greenSpacesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar espacios verdes',
    description:
      'Retorna un listado paginado de espacios verdes. Se puede filtrar por estado, tipo, zona y buscar por nombre.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado paginado de espacios verdes',
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
  async findAll(@Query() query: QueryGreenSpacesDto) {
    return this.greenSpacesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un espacio verde por ID',
    description: 'Retorna el detalle completo de un espacio verde.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del espacio verde',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Espacio verde encontrado',
    type: GreenSpaceResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Espacio verde no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GreenSpaceResponseDto> {
    return this.greenSpacesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un espacio verde',
    description:
      'Actualiza los campos mutables de un espacio verde (nombre, zona, superficie, estado). El tipo de espacio no se puede cambiar después de la creación.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del espacio verde',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Espacio verde actualizado exitosamente',
    type: GreenSpaceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para actualizar espacios verdes',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Espacio verde o zona no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGreenSpaceDto,
  ): Promise<GreenSpaceResponseDto> {
    return this.greenSpacesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Desactivar un espacio verde',
    description:
      'Soft-delete: marca el espacio verde como inactivo. No elimina el registro para preservar el historial de servicios realizados.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del espacio verde',
    format: 'uuid',
  })
  @ApiResponse({
    status: 204,
    description: 'Espacio verde desactivado exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para desactivar espacios verdes',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Espacio verde no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.greenSpacesService.remove(id);
  }
}
