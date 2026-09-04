import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AttachmentsService } from './attachments.service';
import { AttachmentOwnerType } from './attachment-owner-type';
import { EvidenceStorage } from './storage/evidence-storage.interface';

const CONTAINER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const ATTACHMENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const IDEMPOTENCY_KEY = '99999999-9999-9999-9999-999999999999';

/** Un JPEG de verdad: SOI, un Exif con GPS, y los bytes de imagen. */
const EXIF_DATOS = Buffer.from('Exif\0\0GPSLatitude=-34.6037', 'binary');
const EXIF = Buffer.concat([Buffer.from([0xff, 0xe1, 0, 0]), EXIF_DATOS]);
EXIF.writeUInt16BE(EXIF_DATOS.length + 2, 2);

const PIXELES = Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 2, 3, 4, 5, 6, 0xff, 0xd9]);
const JPEG_CON_GPS = Buffer.concat([Buffer.from([0xff, 0xd8]), EXIF, PIXELES]);

/** Lo que queda del JPEG una vez sacado el Exif: SOI + los pixeles. */
const JPEG_LIMPIO_LEN = 2 + PIXELES.length;

const jpegFile = (over: Partial<Express.Multer.File> = {}): Express.Multer.File =>
  ({
    fieldname: 'file',
    originalname: 'medidor-frente.jpg',
    mimetype: 'image/jpeg',
    buffer: JPEG_CON_GPS,
    size: JPEG_CON_GPS.length,
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
      remove: jest.fn().mockResolvedValue(undefined),
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
            size: JPEG_LIMPIO_LEN,
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

    /**
     * Multer reporta el `Content-Type` que declaro el cliente: no mira el
     * archivo. Es el pedido 1 del Issue #90 — el backend tiene que ser la
     * autoridad, no la UI.
     */
    it('rechaza un archivo cuyo contenido no coincide con lo declarado', async () => {
      const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 0x90)]);

      await expect(
        service.upload(
          { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
          jpegFile({ buffer: exe, size: exe.length }),
          IDEMPOTENCY_KEY,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('el mensaje dice que es el archivo de verdad, no solo que fallo', async () => {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

      await expect(
        service.upload(
          { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
          jpegFile({ buffer: png, size: png.length }),
          IDEMPOTENCY_KEY,
        ),
      ).rejects.toThrow(/image\/png/);
    });

    /** El bucket es publico y la foto de un inspector lleva GPS. */
    it('sube el archivo sin los metadatos', async () => {
      await service.upload(
        { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
        jpegFile(),
        IDEMPOTENCY_KEY,
      );

      const [[args]] = storage.upload.mock.calls;
      expect(args.buffer.includes('GPSLatitude')).toBe(false);
      expect(args.buffer.length).toBeLessThan(JPEG_CON_GPS.length);
    });

    it('el tamaño que se guarda es el del archivo limpio, no el que declaro el cliente', async () => {
      await service.upload(
        { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
        jpegFile({ size: 999_999 }),
        IDEMPOTENCY_KEY,
      );

      const [[args]] = prisma.attachment.create.mock.calls;
      expect(args.data.size).toBe(JPEG_LIMPIO_LEN);
    });

    /**
     * El contrato de M2 pide `fileName`, y un inspector abriendo el acta tiene
     * que reconocer la foto: `medidor-frente.jpg` dice algo, un UUID no.
     */
    it('guarda el nombre original, no el UUID de la key del bucket', async () => {
      await service.upload(
        { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
        jpegFile(),
        IDEMPOTENCY_KEY,
      );

      const [[args]] = prisma.attachment.create.mock.calls;
      expect(args.data.filename).toBe('medidor-frente.jpg');
    });

    it('la key del bucket sigue siendo un UUID, no el nombre del cliente', async () => {
      await service.upload(
        { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
        jpegFile(),
        IDEMPOTENCY_KEY,
      );

      const [[args]] = storage.upload.mock.calls;
      expect(args.key).not.toContain('medidor-frente');
      expect(args.key).toMatch(/^evidence\/CONTAINER\/.+\/[0-9a-f-]{36}\.jpg$/);
    });

    it('un nombre con ruta no escapa de la carpeta', async () => {
      await service.upload(
        { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
        jpegFile({ originalname: '../../../etc/passwd' }),
        IDEMPOTENCY_KEY,
      );

      const [[args]] = prisma.attachment.create.mock.calls;
      expect(args.data.filename).toBe('passwd.jpg');
    });

    /**
     * El archivo se sube antes de escribir la fila: si la escritura no
     * prospera, el objeto queda en el bucket sin que nadie lo referencie.
     */
    it('borra el archivo del bucket si la fila no se puede escribir', async () => {
      prisma.attachment.create.mockRejectedValue(new Error('la base se cayo'));

      await expect(
        service.upload(
          { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
          jpegFile(),
          IDEMPOTENCY_KEY,
        ),
      ).rejects.toThrow('la base se cayo');

      const [[key]] = storage.remove.mock.calls;
      expect(key).toBe(storage.upload.mock.calls[0][0].key);
    });

    it('tambien lo borra cuando pierde la carrera de la Idempotency-Key', async () => {
      prisma.attachment.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      );
      prisma.attachment.findUniqueOrThrow.mockResolvedValue({
        id: ATTACHMENT_ID,
        url: 'https://cdn.example.com/evidence/ganador.jpg',
        filename: 'ganador.jpg',
        contentType: 'image/jpeg',
        uploadedAt: new Date('2026-09-02T22:00:00.000Z'),
      });

      const result = await service.upload(
        { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
        jpegFile(),
        IDEMPOTENCY_KEY,
      );

      expect(result.filename).toBe('ganador.jpg');
      expect(storage.remove).toHaveBeenCalledTimes(1);
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
