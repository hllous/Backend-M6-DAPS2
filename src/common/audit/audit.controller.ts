import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ROLES_AUDITORIA } from '../../auth/role-groups';
import { ApiPaginatedResponse, Roles } from '../decorators';
import { ErrorResponseDto } from '../dto';
import { AuditService } from './audit.service';
import { AuditLogResponseDto, QueryAuditDto } from './dto';

@ApiTags('audit')
@ApiBearerAuth('JWT-auth')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles(...ROLES_AUDITORIA)
  @ApiOperation({
    summary: 'Consultar la auditoría de dominio',
    description:
      'Quién hizo qué y cuándo sobre contenedores, expedientes, inspecciones, actas, derivaciones, intervenciones, servicios y catálogos: acción, estado anterior y nuevo, actor (tomado del token) y fecha. Paginado, del más reciente al más antiguo. Filtra por `entityType` y `entityId`. Es de solo agregado: no se edita ni se purga.',
  })
  @ApiPaginatedResponse(AuditLogResponseDto, 'Listado paginado de la auditoría')
  @ApiResponse({ status: 400, description: 'Parámetros inválidos', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  findAll(@Query() query: QueryAuditDto) {
    return this.audit.findAll(query);
  }
}
