import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { AttachmentsService } from './attachments.service';
import { UploadEvidenceDto, EvidenceResponseDto, QueryEvidenceDto } from './dto';
import { AttachmentOwnerType } from './attachment-owner-type';
import { MAX_EVIDENCE_SIZE_BYTES } from './evidence-mime';
import { ErrorResponseDto } from '../../common/dto';
import { ApiNotAssigned, CurrentUser, Roles } from '../../common/decorators';
import { M6Role } from '@prisma/client';
import { ROLES_CAMPO, ROLES_EVIDENCIA_LECTURA } from '../../auth/role-groups';

@ApiTags('evidence')
@ApiBearerAuth('JWT-auth')
@Controller('evidence')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @ApiNotAssigned(
    'la cuadrilla del servicio (SERVICE, ZONE_RESULT) o el inspector asignado (INSPECTION)',
  )
  @Roles(...ROLES_CAMPO)
  // Sin límite, multer bufferea en memoria lo que venga antes de que el
  // service pueda rechazarlo por tamaño.
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_EVIDENCE_SIZE_BYTES, files: 1 } }),
  )
  @ApiOperation({
    summary: 'Subir evidencia (foto/PDF) para un recurso existente',
    description:
      'Endpoint genérico de evidencia — un archivo por llamada, atado a un ownerType/ownerId ' +
      'que ya debe existir (Container, Service, ZoneResult o EnvironmentalInspection). ' +
      'Requiere el header Idempotency-Key para identificar reintentos.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiHeader({
    name: 'Idempotency-Key',
    description:
      'UUID generado por el cliente, único por intento de subida. Reenviar el mismo valor en un reintento evita crear evidencia duplicada.',
    required: true,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'ownerType', 'ownerId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        ownerType: { type: 'string', enum: Object.values(AttachmentOwnerType) },
        ownerId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Evidencia subida', type: EvidenceResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'Archivo faltante, tipo no permitido, más de un archivo en la llamada o falta Idempotency-Key',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({
    status: 404,
    description: 'El recurso referenciado por ownerType/ownerId no existe',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 413,
    description: 'El archivo supera los 10 MB (lo corta multer antes de terminar de recibirlo)',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  @ApiResponse({
    status: 503,
    description:
      'Storage de evidencia (R2) no configurado en el servidor. No se persiste nada: el reintento con la misma Idempotency-Key es seguro',
    type: ErrorResponseDto,
  })
  async upload(
    @Body() dto: UploadEvidenceDto,
    @UploadedFile() file: Express.Multer.File,
    @Headers('Idempotency-Key') idempotencyKey: string,
    @CurrentUser('roles') roles: M6Role[],
    @CurrentUser('userId') userId: string,
  ): Promise<EvidenceResponseDto> {
    return this.attachmentsService.upload(dto, file, idempotencyKey, roles, userId);
  }

  @Get()
  @ApiNotAssigned(
    'la cuadrilla del servicio (SERVICE, ZONE_RESULT) o el inspector asignado (INSPECTION)',
  )
  @Roles(...ROLES_EVIDENCIA_LECTURA)
  @ApiOperation({
    summary: 'Listar evidencia de un recurso',
    description:
      'Retorna toda la evidencia asociada a un ownerType/ownerId, ordenada por fecha. ' +
      'Campo solo ve la de lo suyo (cuadrilla del servicio, inspector asignado); Oficina, Admin y Auditoría ven cualquiera.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de evidencia',
    type: EvidenceResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({
    status: 404,
    description: 'Campo consulta un recurso que no existe',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findByOwner(
    @Query() query: QueryEvidenceDto,
    @CurrentUser('roles') roles: M6Role[],
    @CurrentUser('userId') userId: string,
  ): Promise<EvidenceResponseDto[]> {
    return this.attachmentsService.findByOwner(query, roles, userId);
  }
}
