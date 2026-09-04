import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { AttachmentOwnerType } from '../attachment-owner-type';

/**
 * Campos de texto del multipart/form-data de `POST /evidence`.
 * El archivo en sí llega aparte, vía `@UploadedFile()` (campo `file`).
 */
export class UploadEvidenceDto {
  @ApiProperty({
    description: 'Tipo de recurso al que se adjunta la evidencia',
    enum: AttachmentOwnerType,
    example: AttachmentOwnerType.CONTAINER,
  })
  @IsEnum(AttachmentOwnerType)
  ownerType: AttachmentOwnerType;

  @ApiProperty({
    description: 'UUID del recurso (ya existente) al que se adjunta la evidencia',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  ownerId: string;
}
