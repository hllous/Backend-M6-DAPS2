import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { AttachmentOwnerType } from '../attachment-owner-type';

export class QueryEvidenceDto {
  @ApiProperty({
    description: 'Tipo de recurso dueño de la evidencia',
    enum: AttachmentOwnerType,
    example: AttachmentOwnerType.CONTAINER,
  })
  @IsEnum(AttachmentOwnerType)
  ownerType: AttachmentOwnerType;

  @ApiProperty({
    description: 'UUID del recurso dueño de la evidencia',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  ownerId: string;
}
