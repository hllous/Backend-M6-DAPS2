import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { M6Role, Prisma } from '@prisma/client';
import { notAssignedException, roleRequiredException } from '../../common/decorators';
import { ROLES_CAMPO } from '../../auth/role-groups';
import { belongsToCrew, isInspectionAssignee } from '../../common/ownership';
import { paraLog } from '../../events/log-safe';
import { PrismaService } from '../../prisma/prisma.service';
import { AttachmentOwnerType } from './attachment-owner-type';
import { EvidenceResponseDto, QueryEvidenceDto, UploadEvidenceDto } from './dto';
import { EVIDENCE_EXTENSION_BY_MIME, MAX_EVIDENCE_SIZE_BYTES } from './evidence-mime';
import { sanitizeFilename, sniffMime, stripMetadata } from './evidence-file';
import { EVIDENCE_STORAGE, EvidenceStorage } from './storage/evidence-storage.interface';

/**
 * Quién puede subir evidencia de cada tipo de recurso. Lo de la inspección es del
 * inspector; lo del servicio, la zona y el contenedor es de la cuadrilla. Un
 * M6_ADMIN no tiene Campo (ADR-005), así que no sube evidencia.
 * La pertenencia (solo sobre lo suyo) va aparte: `assertOwnerAccess`.
 */
const UPLOAD_ROLES: Record<AttachmentOwnerType, readonly M6Role[]> = {
  [AttachmentOwnerType.INSPECTION]: [M6Role.M6_CAMPO_INSPECTOR],
  [AttachmentOwnerType.SERVICE]: [M6Role.M6_CAMPO_CUADRILLA],
  [AttachmentOwnerType.ZONE_RESULT]: [M6Role.M6_CAMPO_CUADRILLA],
  [AttachmentOwnerType.CONTAINER]: [M6Role.M6_CAMPO_CUADRILLA],
};

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
    roles: readonly M6Role[],
    userId: string,
  ): Promise<EvidenceResponseDto> {
    // Primero el rol: un 403 no debe depender de qué tan bien armado venga el resto.
    if (!UPLOAD_ROLES[dto.ownerType].some((r) => roles.includes(r))) {
      throw roleRequiredException();
    }
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

    // El `mimetype` de Multer es el que declaró el cliente: no inspecciona el
    // archivo. Acá se mira el contenido, que es lo único que no se puede
    // falsear renombrando (Issue #90).
    const real = sniffMime(file.buffer);
    if (real !== file.mimetype) {
      throw new BadRequestException(
        real
          ? `El archivo dice ser ${file.mimetype} pero su contenido es ${real}`
          : `El contenido del archivo no corresponde a ningún tipo aceptado`,
      );
    }

    await this.assertOwnerAccess(dto.ownerType, dto.ownerId, userId);

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

    // La foto de un inspector lleva GPS, fecha y modelo del teléfono, y el
    // bucket es público. Se limpia antes de subir, no después.
    const limpio = stripMetadata(file.buffer, file.mimetype);

    const key = `evidence/${dto.ownerType}/${dto.ownerId}/${randomUUID()}.${extension}`;
    const { url } = await this.storage.upload({
      buffer: limpio,
      key,
      contentType: file.mimetype,
    });

    try {
      const attachment = await this.prisma.attachment.create({
        data: {
          ownerType: dto.ownerType,
          ownerId: dto.ownerId,
          url,
          // El nombre que puso quien sacó la foto, no el UUID de la key:
          // `medidor-frente.jpg` le dice algo a quien abre el acta.
          filename: sanitizeFilename(file.originalname, extension),
          contentType: file.mimetype,
          size: limpio.length,
          idempotencyKey,
        },
      });

      this.logger.log(`Evidencia subida: ${attachment.id} (owner=${dto.ownerType}/${dto.ownerId})`);
      return this.toResponseDto(attachment);
    } catch (error) {
      // El archivo ya está en el bucket: si la fila no se escribe, el objeto
      // queda sin que nadie lo referencie nunca.
      await this.storage.remove(key);

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Carrera: dos reintentos concurrentes con la misma Idempotency-Key.
        // El otro ganó la inserción primero — devolvemos ese registro.
        const raced = await this.prisma.attachment.findUniqueOrThrow({ where: uniqueKey });
        return this.toResponseDto(raced);
      }
      throw error;
    }
  }

  async findByOwner(
    query: QueryEvidenceDto,
    roles: readonly M6Role[],
    userId: string,
  ): Promise<EvidenceResponseDto[]> {
    // Campo ve solo lo suyo; cualquier otro rol de lectura (Oficina, Auditoría) ve todo.
    if (roles.every((r) => (ROLES_CAMPO as readonly M6Role[]).includes(r))) {
      await this.assertOwnerAccess(query.ownerType, query.ownerId, userId);
    }
    const attachments = await this.prisma.attachment.findMany({
      where: { ownerType: query.ownerType, ownerId: query.ownerId },
      orderBy: { uploadedAt: 'asc' },
    });

    return attachments.map((a) => this.toResponseDto(a));
  }

  /**
   * 404 si el dueño no existe; después, la pertenencia (#365): SERVICE y
   * ZONE_RESULT, solo la cuadrilla del servicio; INSPECTION, el inspector
   * asignado (o cualquiera si no hay); CONTAINER no tiene dueño de Campo.
   */
  private async assertOwnerAccess(
    ownerType: AttachmentOwnerType,
    ownerId: string,
    userId: string,
  ): Promise<void> {
    let allowed: boolean | undefined; // undefined = el dueño no existe
    switch (ownerType) {
      case AttachmentOwnerType.CONTAINER:
        allowed =
          (await this.prisma.container.count({ where: { id: ownerId } })) > 0 ? true : undefined;
        break;
      case AttachmentOwnerType.SERVICE: {
        const service = await this.prisma.service.findUnique({
          where: { id: ownerId },
          select: { crewId: true },
        });
        allowed = service ? await belongsToCrew(this.prisma, service.crewId, userId) : undefined;
        break;
      }
      case AttachmentOwnerType.ZONE_RESULT: {
        const result = await this.prisma.zoneResult.findUnique({
          where: { id: ownerId },
          select: { service: { select: { crewId: true } } },
        });
        allowed = result
          ? await belongsToCrew(this.prisma, result.service.crewId, userId)
          : undefined;
        break;
      }
      case AttachmentOwnerType.INSPECTION: {
        const inspection = await this.prisma.environmentalInspection.findUnique({
          where: { id: ownerId },
          select: { inspectorId: true },
        });
        allowed = inspection ? isInspectionAssignee(inspection.inspectorId, userId) : undefined;
        break;
      }
    }
    if (allowed === undefined) {
      throw new NotFoundException(`${ownerType} con id '${ownerId}' no encontrado`);
    }
    if (!allowed) {
      this.logger.warn(
        `Denegado NOT_ASSIGNED: usuario ${paraLog(userId)} sobre ${ownerType}/${paraLog(ownerId)}`,
      );
      throw notAssignedException();
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
