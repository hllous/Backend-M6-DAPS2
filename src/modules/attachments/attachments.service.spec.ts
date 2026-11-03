import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { M6Role, Prisma } from '@prisma/client';
import { AttachmentsService } from './attachments.service';
import { AttachmentOwnerType } from './attachment-owner-type';
import { EvidenceStorage } from './storage/evidence-storage.interface';

const USER_ID = '4242';
const CONTAINER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const ATTACHMENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CAMPO = [M6Role.M6_CAMPO_CUADRILLA, M6Role.M6_CAMPO_INSPECTOR];
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
  describe('rol por tipo de recurso', () => {
    const { M6_CAMPO_CUADRILLA: CUADRILLA, M6_CAMPO_INSPECTOR: INSPECTOR } = M6Role;
    const casos: [AttachmentOwnerType, M6Role, M6Role[]][] = [
      [AttachmentOwnerType.INSPECTION, INSPECTOR, [CUADRILLA, M6Role.M6_ADMIN, M6Role.M6_AUDITOR]],
      [
        AttachmentOwnerType.SERVICE,
        CUADRILLA,
        [INSPECTOR, M6Role.M6_ADMIN, M6Role.M6_OFICINA_OPERACIONES],
      ],
      [AttachmentOwnerType.ZONE_RESULT, CUADRILLA, [INSPECTOR, M6Role.M6_ADMIN]],
      [AttachmentOwnerType.CONTAINER, CUADRILLA, [INSPECTOR, M6Role.M6_ADMIN]],
    ];

    it.each(casos)(
      '%s: solo %s; los demás roles reciben 403 ROLE_REQUIRED',
      async (tipo, ok, otros) => {
        for (const rol of otros) {
          const error = await service
            .upload(
              { ownerType: tipo, ownerId: CONTAINER_ID } as never,
              jpegFile(),
              IDEMPOTENCY_KEY,
              [rol],
              USER_ID,
            )
            .catch((e) => e);
          expect(error).toBeInstanceOf(ForbiddenException);
          expect(error.getResponse()).toMatchObject({ code: 'ROLE_REQUIRED' });
          expect(JSON.stringify(error.getResponse())).not.toContain('M6_');
        }
        expect(prisma.attachment.create).not.toHaveBeenCalled();
        expect(storage.upload).not.toHaveBeenCalled();

        // Con el rol correcto el chequeo de rol no frena (puede fallar luego por otra razón).
        const res = await service
          .upload(
            { ownerType: tipo, ownerId: CONTAINER_ID } as never,
            jpegFile(),
            IDEMPOTENCY_KEY,
            [ok],
            USER_ID,
          )
          .catch((e) => e);
        expect(res).not.toBeInstanceOf(ForbiddenException);
      },
    );

    it('sin roles en el request también es 403', async () => {
      await expect(
        service.upload(
          { ownerType: 'CONTAINER', ownerId: CONTAINER_ID } as never,
          jpegFile(),
          IDEMPOTENCY_KEY,
          [],
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  let prisma: any;
  let storage: jest.Mocked<EvidenceStorage>;
  let service: AttachmentsService;

  beforeEach(() => {
    prisma = {
      container: { count: jest.fn().mockResolvedValue(1) },
      service: { findUnique: jest.fn().mockResolvedValue(null) },
      zoneResult: { findUnique: jest.fn().mockResolvedValue(null) },
      environmentalInspection: { findUnique: jest.fn().mockResolvedValue(null) },
      crew: { count: jest.fn().mockResolvedValue(0) },
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
        CAMPO,
        USER_ID,
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
        CAMPO,
        USER_ID,
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
          CAMPO,
          USER_ID,
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
          CAMPO,
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza sin Idempotency-Key', async () => {
      await expect(
        service.upload(
          { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
          jpegFile(),
          '',
          CAMPO,
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza un tipo de archivo no permitido', async () => {
      await expect(
        service.upload(
          { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
          jpegFile({ mimetype: 'application/zip' }),
          IDEMPOTENCY_KEY,
          CAMPO,
          USER_ID,
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
          CAMPO,
          USER_ID,
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
          CAMPO,
          USER_ID,
        ),
      ).rejects.toThrow(/image\/png/);
    });

    /** El bucket es publico y la foto de un inspector lleva GPS. */
    it('sube el archivo sin los metadatos', async () => {
      await service.upload(
        { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
        jpegFile(),
        IDEMPOTENCY_KEY,
        CAMPO,
        USER_ID,
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
        CAMPO,
        USER_ID,
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
        CAMPO,
        USER_ID,
      );

      const [[args]] = prisma.attachment.create.mock.calls;
      expect(args.data.filename).toBe('medidor-frente.jpg');
    });

    it('la key del bucket sigue siendo un UUID, no el nombre del cliente', async () => {
      await service.upload(
        { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
        jpegFile(),
        IDEMPOTENCY_KEY,
        CAMPO,
        USER_ID,
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
        CAMPO,
        USER_ID,
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
          CAMPO,
          USER_ID,
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
        CAMPO,
        USER_ID,
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
          CAMPO,
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    describe('con el storage sin configurar', () => {
      const owner = { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID };

      beforeEach(() => {
        storage.upload.mockRejectedValue(new ServiceUnavailableException('sin R2'));
      });

      it('el camino válido responde 503 y no persiste nada (la Idempotency-Key queda libre)', async () => {
        await expect(
          service.upload(owner, jpegFile(), IDEMPOTENCY_KEY, CAMPO, USER_ID),
        ).rejects.toThrow(ServiceUnavailableException);
        expect(prisma.attachment.create).not.toHaveBeenCalled();
      });

      it('las validaciones previas siguen dando 400/404 y no llegan al storage', async () => {
        await expect(
          service.upload(owner, jpegFile({ size: 999_999_999 }), IDEMPOTENCY_KEY, CAMPO, USER_ID),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.upload(
            owner,
            jpegFile({ mimetype: 'text/plain', buffer: Buffer.from('hola') }),
            IDEMPOTENCY_KEY,
            CAMPO,
            USER_ID,
          ),
        ).rejects.toThrow(BadRequestException);
        await expect(service.upload(owner, jpegFile(), '', CAMPO, USER_ID)).rejects.toThrow(
          BadRequestException,
        );
        prisma.container.count.mockResolvedValue(0);
        await expect(
          service.upload(owner, jpegFile(), IDEMPOTENCY_KEY, CAMPO, USER_ID),
        ).rejects.toThrow(NotFoundException);
        expect(storage.upload).not.toHaveBeenCalled();
      });
    });
  });

  // #365: la evidencia de un servicio es de su cuadrilla; la de una inspección, del asignado.
  describe('pertenencia (#365)', () => {
    const SERVICE_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const subir = (ownerType: AttachmentOwnerType, ownerId: string) =>
      service.upload({ ownerType, ownerId }, jpegFile(), IDEMPOTENCY_KEY, CAMPO, USER_ID);

    it.each([AttachmentOwnerType.SERVICE, AttachmentOwnerType.ZONE_RESULT])(
      '%s de una cuadrilla ajena (o sin cuadrilla): 403 NOT_ASSIGNED y no sube nada',
      async (tipo) => {
        prisma.service.findUnique.mockResolvedValue({ crewId: 'crew-1' });
        prisma.zoneResult.findUnique.mockResolvedValue({ service: { crewId: null } });

        const error = await subir(tipo, SERVICE_ID).catch((e) => e);

        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.getResponse()).toMatchObject({ code: 'NOT_ASSIGNED' });
        expect(storage.upload).not.toHaveBeenCalled();
      },
    );

    it.each([
      [AttachmentOwnerType.SERVICE, 'service'],
      [AttachmentOwnerType.ZONE_RESULT, 'zoneResult'],
    ])('%s de la propia cuadrilla se sube', async (tipo, modelo) => {
      prisma[modelo].findUnique.mockResolvedValue({
        crewId: 'crew-1',
        service: { crewId: 'crew-1' },
      });
      prisma.crew.count.mockResolvedValue(1);

      await expect(subir(tipo, SERVICE_ID)).resolves.toBeDefined();
      expect(prisma.crew.count).toHaveBeenCalledWith({
        where: {
          id: 'crew-1',
          OR: [{ leaderUserId: USER_ID }, { members: { some: { userId: USER_ID } } }],
        },
      });
    });

    it('INSPECTION asignada a otro: 403; a mí o sin asignar: se sube', async () => {
      prisma.environmentalInspection.findUnique.mockResolvedValue({ inspectorId: '7' });
      await expect(subir(AttachmentOwnerType.INSPECTION, SERVICE_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      for (const inspectorId of [USER_ID, null]) {
        prisma.environmentalInspection.findUnique.mockResolvedValue({ inspectorId });
        await expect(subir(AttachmentOwnerType.INSPECTION, SERVICE_ID)).resolves.toBeDefined();
      }
    });

    it('el dueño inexistente sigue siendo 404 (no 403)', async () => {
      await expect(subir(AttachmentOwnerType.SERVICE, SERVICE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('CONTAINER no depende de la cuadrilla', async () => {
      await expect(subir(AttachmentOwnerType.CONTAINER, CONTAINER_ID)).resolves.toBeDefined();
      expect(prisma.crew.count).not.toHaveBeenCalled();
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

      const result = await service.findByOwner(
        { ownerType: AttachmentOwnerType.CONTAINER, ownerId: CONTAINER_ID },
        [M6Role.M6_OFICINA_AMBIENTAL],
        USER_ID,
      );

      expect(result).toEqual([
        expect.objectContaining({ id: ATTACHMENT_ID, contentType: 'image/jpeg' }),
      ]);
    });

    // #466: Campo solo lee la evidencia de lo suyo; el resto de los roles de lectura, todo.
    it('Campo sobre un servicio de otra cuadrilla: 403 NOT_ASSIGNED y no consulta evidencia', async () => {
      prisma.service.findUnique.mockResolvedValue({ crewId: 'crew-1' });
      prisma.crew.count.mockResolvedValue(0);

      const error = await service
        .findByOwner(
          { ownerType: AttachmentOwnerType.SERVICE, ownerId: CONTAINER_ID },
          [M6Role.M6_CAMPO_CUADRILLA],
          USER_ID,
        )
        .catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.getResponse()).toMatchObject({ code: 'NOT_ASSIGNED' });
      expect(prisma.attachment.findMany).not.toHaveBeenCalled();
    });

    it('Campo sobre lo propio lee', async () => {
      prisma.service.findUnique.mockResolvedValue({ crewId: 'crew-1' });
      prisma.crew.count.mockResolvedValue(1);
      prisma.attachment.findMany.mockResolvedValue([]);

      await expect(
        service.findByOwner(
          { ownerType: AttachmentOwnerType.SERVICE, ownerId: CONTAINER_ID },
          [M6Role.M6_CAMPO_CUADRILLA],
          USER_ID,
        ),
      ).resolves.toEqual([]);
    });

    it.each([M6Role.M6_ADMIN, M6Role.M6_OFICINA_OPERACIONES, M6Role.M6_AUDITOR])(
      '%s lee la evidencia de un servicio ajeno sin chequear pertenencia',
      async (rol) => {
        prisma.attachment.findMany.mockResolvedValue([]);

        await expect(
          service.findByOwner(
            { ownerType: AttachmentOwnerType.SERVICE, ownerId: CONTAINER_ID },
            [rol],
            USER_ID,
          ),
        ).resolves.toEqual([]);
        expect(prisma.service.findUnique).not.toHaveBeenCalled();
      },
    );

    // #466
    describe('Campo: dueño inexistente y Oficina', () => {
      const leer = (ownerType: AttachmentOwnerType, rol: M6Role) =>
        service.findByOwner({ ownerType, ownerId: CONTAINER_ID }, [rol], USER_ID);

      it('dueño inexistente: 404', async () => {
        await expect(
          leer(AttachmentOwnerType.SERVICE, M6Role.M6_CAMPO_CUADRILLA),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it('Oficina Ambiental lee sin chequear rol ni pertenencia', async () => {
        await expect(
          leer(AttachmentOwnerType.INSPECTION, M6Role.M6_OFICINA_AMBIENTAL),
        ).resolves.toEqual([]);
        expect(prisma.environmentalInspection.findUnique).not.toHaveBeenCalled();
      });
    });
  });
});
