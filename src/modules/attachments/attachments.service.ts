import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AttachmentOwnerType } from './attachment-owner-type';
import { EvidenceResponseDto, QueryEvidenceDto, UploadEvidenceDto } from './dto';
import { EVIDENCE_EXTENSION_BY_MIME, MAX_EVIDENCE_SIZE_BYTES } from './evidence-mime';
import { EVIDENCE_STORAGE, EvidenceStorage } from './storage/evidence-storage.interface';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVIDENCE_STORAGE) private readonly storage: EvidenceStorage,
  ) {}

  async upload(
    dto: UploadEvidenceDto,
    file: Express.Multer.File,
    idempotencyKey: string,
  ): Promise<EvidenceResponseDto> {
    if (!file) {
      throw new BadRequestException('Falta el archivo (campo "file")');
    }
    if (!idempotencyKey) {
      throw new BadRequestException('Falta el header Idempotency-Key');
    }
    if (file.size > MAX_EVIDENCE_SIZE_BYTES) {
      throw new BadRequestException(
        `El archivo supera el tamaño máximo permitido (${MAX_EVIDENCE_SIZE_BYTES / 1024 / 1024} MB)`,
      );
    }
    const extension = EVIDENCE_EXTENSION_BY_MIME[file.mimetype];
    if (!extension) {
      throw new BadRequestException(
        `Tipo de archivo no permitido: ${file.mimetype}. Aceptados: ${Object.keys(EVIDENCE_EXTENSION_BY_MIME).join(', ')}`,
      );
    }

    await this.assertOwnerExists(dto.ownerType, dto.ownerId);

    const uniqueKey = {
      ownerType_ownerId_idempotencyKey: {
        ownerType: dto.ownerType,
        ownerId: dto.ownerId,
        idempotencyKey,
      },
    };

    const existing = await this.prisma.attachment.findUnique({ where: uniqueKey });
    if (existing) {
      this.logger.log(
        `Idempotency-Key repetida — devuelvo el attachment existente: ${existing.id}`,
      );
      return this.toResponseDto(existing);
    }

    const key = `evidence/${dto.ownerType}/${dto.ownerId}/${randomUUID()}.${extension}`;
    const { url } = await this.storage.upload({
      buffer: file.buffer,
      key,
      contentType: file.mimetype,
    });

    try {
      const attachment = await this.prisma.attachment.create({
        data: {
          ownerType: dto.ownerType,
          ownerId: dto.ownerId,
          url,
          filename: key.split('/').pop() as string,
          contentType: file.mimetype,
          size: file.size,
          idempotencyKey,
        },
      });

      this.logger.log(`Evidencia subida: ${attachment.id} (owner=${dto.ownerType}/${dto.ownerId})`);
      return this.toResponseDto(attachment);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Carrera: dos reintentos concurrentes con la misma Idempotency-Key.
        // El otro ganó la inserción primero — devolvemos ese registro.
        const raced = await this.prisma.attachment.findUniqueOrThrow({ where: uniqueKey });
        return this.toResponseDto(raced);
      }
      throw error;
    }
  }

  async findByOwner(query: QueryEvidenceDto): Promise<EvidenceResponseDto[]> {
    const attachments = await this.prisma.attachment.findMany({
      where: { ownerType: query.ownerType, ownerId: query.ownerId },
      orderBy: { uploadedAt: 'asc' },
    });

    return attachments.map((a) => this.toResponseDto(a));
  }

  private async assertOwnerExists(ownerType: AttachmentOwnerType, ownerId: string): Promise<void> {
    const exists = await this.ownerExists(ownerType, ownerId);
    if (!exists) {
      throw new NotFoundException(`${ownerType} con id '${ownerId}' no encontrado`);
    }
  }

  private async ownerExists(ownerType: AttachmentOwnerType, ownerId: string): Promise<boolean> {
    switch (ownerType) {
      case AttachmentOwnerType.CONTAINER:
        return (await this.prisma.container.count({ where: { id: ownerId } })) > 0;
      case AttachmentOwnerType.SERVICE:
        return (await this.prisma.service.count({ where: { id: ownerId } })) > 0;
      case AttachmentOwnerType.ZONE_RESULT:
        return (await this.prisma.zoneResult.count({ where: { id: ownerId } })) > 0;
      case AttachmentOwnerType.INSPECTION:
        return (await this.prisma.environmentalInspection.count({ where: { id: ownerId } })) > 0;
    }
  }

  private toResponseDto(attachment: {
    id: string;
    url: string;
    filename: string;
    contentType: string;
    uploadedAt: Date;
  }): EvidenceResponseDto {
    return {
      id: attachment.id,
      url: attachment.url,
      filename: attachment.filename,
      contentType: attachment.contentType,
      uploadedAt: attachment.uploadedAt.toISOString(),
    };
  }
}
