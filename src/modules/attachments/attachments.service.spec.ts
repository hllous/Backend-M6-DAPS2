import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { AttachmentOwnerType } from './attachment-owner-type';
import { EvidenceStorage } from './storage/evidence-storage.interface';

const CONTAINER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const ATTACHMENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const IDEMPOTENCY_KEY = '99999999-9999-9999-9999-999999999999';

const jpegFile = (over: Partial<Express.Multer.File> = {}): Express.Multer.File =>
  ({
    fieldname: 'file',
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image-bytes'),
    size: 1024,
    ...over,
  }) as Express.Multer.File;

describe('AttachmentsService', () => {
  let prisma: any;
  let storage: jest.Mocked<EvidenceStorage>;
  let service: AttachmentsService;

  beforeEach(() => {
    prisma = {
      container: { count: jest.fn().mockResolvedValue(1) },
      service: { count: jest.fn().mockResolvedValue(0) },
      zoneResult: { count: jest.fn().mockResolvedValue(0) },
      environmentalInspection: { count: jest.fn().mockResolvedValue(0) },
      attachment: {
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: ATTACHMENT_ID,
            uploadedAt: new Date('2026-09-02T22:00:00.000Z'),
            ...data,
          }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    storage = {
      upload: jest.fn().mockResolvedValue({ url: 'https://cdn.example.com/evidence/x.jpg' }),
    };
    service = new AttachmentsService(prisma, storage);
  });

  describe('upload', () => {
    it('sube el archivo y persiste el Attachment cuando el owner existe', async () => {
      const result = await service.upload(
        { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
        jpegFile(),
        IDEMPOTENCY_KEY,
      );

      expect(prisma.container.count).toHaveBeenCalledWith({ where: { id: CONTAINER_ID } });
      expect(storage.upload).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: 'image/jpeg' }),
      );
      expect(prisma.attachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerType: AttachmentOwnerType.CONTAINER,
            ownerId: CONTAINER_ID,
            url: 'https://cdn.example.com/evidence/x.jpg',
            contentType: 'image/jpeg',
            size: 1024,
            idempotencyKey: IDEMPOTENCY_KEY,
          }),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: ATTACHMENT_ID,
          url: 'https://cdn.example.com/evidence/x.jpg',
          contentType: 'image/jpeg',
        }),
      );
    });

    it('con una Idempotency-Key ya usada, devuelve el attachment existente sin volver a subir', async () => {
      const existing = {
        id: ATTACHMENT_ID,
        url: 'https://cdn.example.com/evidence/previo.jpg',
        filename: 'previo.jpg',
        contentType: 'image/jpeg',
        uploadedAt: new Date('2026-09-02T22:00:00.000Z'),
      };
      prisma.attachment.findUnique.mockResolvedValue(existing);

      const result = await service.upload(
        { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
        jpegFile(),
        IDEMPOTENCY_KEY,
      );

      expect(prisma.attachment.findUnique).toHaveBeenCalledWith({
        where: {
          ownerType_ownerId_idempotencyKey: {
            ownerType: AttachmentOwnerType.CONTAINER,
            ownerId: CONTAINER_ID,
            idempotencyKey: IDEMPOTENCY_KEY,
          },
        },
      });
      expect(storage.upload).not.toHaveBeenCalled();
      expect(prisma.attachment.create).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ id: ATTACHMENT_ID }));
    });

    it('rechaza si el owner no existe', async () => {
      prisma.container.count.mockResolvedValue(0);

      await expect(
        service.upload(
          { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
          jpegFile(),
          IDEMPOTENCY_KEY,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rechaza sin archivo', async () => {
      await expect(
        service.upload(
          { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
          undefined as unknown as Express.Multer.File,
          IDEMPOTENCY_KEY,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza sin Idempotency-Key', async () => {
      await expect(
        service.upload(
          { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
          jpegFile(),
          '',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza un tipo de archivo no permitido', async () => {
      await expect(
        service.upload(
          { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
          jpegFile({ mimetype: 'application/zip' }),
          IDEMPOTENCY_KEY,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rechaza un archivo que supera el tamaño máximo', async () => {
      await expect(
        service.upload(
          { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
          jpegFile({ size: 999_999_999 }),
          IDEMPOTENCY_KEY,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });
  });

  describe('findByOwner', () => {
    it('lista la evidencia de un owner', async () => {
      prisma.attachment.findMany.mockResolvedValue([
        {
          id: ATTACHMENT_ID,
          url: 'https://cdn.example.com/evidence/x.jpg',
          filename: 'x.jpg',
          contentType: 'image/jpeg',
          uploadedAt: new Date('2026-09-02T22:00:00.000Z'),
        },
      ]);

      const result = await service.findByOwner({
        ownerType: AttachmentOwnerType.CONTAINER,
        ownerId: CONTAINER_ID,
      });

      expect(result).toEqual([
        expect.objectContaining({ id: ATTACHMENT_ID, contentType: 'image/jpeg' }),
      ]);
    });
  });
});
