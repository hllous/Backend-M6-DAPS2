import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, RiskLevel } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { OutboxService } from '../../../events/outbox/outbox.service';
import { TreeSurveysService } from './tree-surveys.service';

// Los schemas declaran draft 2020-12; el export por defecto de ajv es draft-07.
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

const TREE = '55555555-5555-5555-5555-555555555555';
const SURVEY = '66666666-6666-6666-6666-666666666666';

const leerSchema = (f: string) =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../../../docs/eventos/publicados', f), 'utf8'),
  );
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
ajv.addSchema(leerSchema('_shared.schema.json'), '_shared.schema.json');
const validarTreeRiskDetected = ajv.compile(leerSchema('treeRiskDetected.schema.json'));

describe('TreeSurveysService', () => {
  let prisma: any;
  let outbox: any;
  let service: TreeSurveysService;

  const arbol = () => ({
    id: TREE,
    surveyCode: 'AR-0001',
    species: 'Jacarandá',
    zoneId: 'z-centro',
    address: 'Av. Mitre 1200',
    lat: new Prisma.Decimal('-34.6037'),
    lng: new Prisma.Decimal('-58.3816'),
  });

  const relevamiento = (over: Record<string, unknown> = {}) => ({
    id: SURVEY,
    treeId: TREE,
    surveyedAt: new Date('2026-08-20T10:00:00.000Z'),
    inspectorId: 'insp-1',
    healthStatus: 'WEAKENED',
    riskLevel: RiskLevel.LOW,
    riskType: null,
    suggestedIntervention: null,
    requiresStreetClosure: false,
    requiresPublicWorks: false,
    notes: null,
    createdAt: new Date('2026-08-20T10:05:00.000Z'),
    ...over,
  });

  const dto = (over: Record<string, unknown> = {}) =>
    ({
      surveyedAt: '2026-08-20T10:00:00.000Z',
      healthStatus: 'WEAKENED',
      riskLevel: RiskLevel.LOW,
      ...over,
    }) as any;

  // Los riesgos que salen al bus exigen riskType: el schema del evento lo pide.
  const dtoAlto = (over: Record<string, unknown> = {}) =>
    dto({ riskLevel: RiskLevel.HIGH, riskType: 'FALLING_BRANCH', ...over });

  beforeEach(() => {
    prisma = {
      tree: { findUnique: jest.fn().mockResolvedValue(arbol()) },
      treeSurvey: {
        create: jest
          .fn()
          .mockImplementation(({ data }: any) => Promise.resolve(relevamiento(data))),
        findMany: jest.fn().mockResolvedValue([relevamiento()]),
        findFirst: jest.fn().mockResolvedValue(relevamiento()),
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    service = new TreeSurveysService(
      prisma as unknown as PrismaService,
      outbox as unknown as OutboxService,
    );
  });

  describe('create', () => {
    it('un árbol inexistente da 404 sin escribir nada', async () => {
      prisma.tree.findUnique.mockResolvedValue(null);

      await expect(service.create(TREE, dto())).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.treeSurvey.create).not.toHaveBeenCalled();
    });

    it('los booleanos ausentes quedan en false, no en null', async () => {
      await service.create(TREE, dto());

      expect(prisma.treeSurvey.create.mock.calls[0][0].data).toMatchObject({
        requiresStreetClosure: false,
        requiresPublicWorks: false,
        inspectorId: null,
        riskType: null,
        suggestedIntervention: null,
      });
    });

    describe('surveyedAt y el día en Argentina', () => {
      // Solo se falsea Date: el resto de los timers reales mantiene andando las promesas.
      const reloj = (iso: string) =>
        jest.useFakeTimers({
          now: new Date(iso),
          doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask'],
        });
      afterEach(() => jest.useRealTimers());

      it.each([
        ['mañana en Argentina', '2026-09-20T05:59:00.000Z', '2026-09-21T03:00:00.000Z'],
        ['dentro de 2 días', '2026-09-20T05:59:00.000Z', '2026-09-22T12:00:00.000Z'],
        ['00:00 local del día siguiente', '2026-09-21T02:59:00.000Z', '2026-09-21T03:00:00.000Z'],
      ])('%s da 400 sin escribir nada', async (_n, ahora, surveyedAt) => {
        reloj(ahora);

        await expect(service.create(TREE, dto({ surveyedAt }))).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(prisma.treeSurvey.create).not.toHaveBeenCalled();
      });

      it.each([
        ['T12:00Z de hoy a las 06:00 UTC', '2026-09-20T06:00:00.000Z', '2026-09-20T12:00:00.000Z'],
        ['más tarde del mismo día local', '2026-09-20T05:59:00.000Z', '2026-09-20T23:59:00.000Z'],
        ['20/09 21:00 local, aún hoy', '2026-09-21T02:59:00.000Z', '2026-09-21T02:00:00.000Z'],
      ])('%s da 201', async (_n, ahora, surveyedAt) => {
        reloj(ahora);

        await expect(service.create(TREE, dto({ surveyedAt }))).resolves.toBeDefined();
      });
    });

    it.each([RiskLevel.HIGH, RiskLevel.CRITICAL])(
      'un riesgo %s sin riskType da 400 sin escribir nada',
      async (riskLevel) => {
        await expect(service.create(TREE, dto({ riskLevel }))).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(prisma.treeSurvey.create).not.toHaveBeenCalled();
        expect(outbox.enqueue).not.toHaveBeenCalled();
      },
    );

    it('el payload publicado cumple el schema del evento', async () => {
      await service.create(TREE, dtoAlto({ healthStatus: 'DISEASED' }));

      const [, entrada] = outbox.enqueue.mock.calls[0];
      expect(validarTreeRiskDetected(entrada.payload)).toBe(true);
    });

    // ─── El umbral que decide si sale al bus ─────────

    it.each([RiskLevel.HIGH, RiskLevel.CRITICAL])(
      'un riesgo %s publica treeRiskDetected',
      async (riskLevel) => {
        await service.create(TREE, dtoAlto({ riskLevel }));

        expect(outbox.enqueue).toHaveBeenCalledTimes(1);
        const [, entrada] = outbox.enqueue.mock.calls[0];
        expect(entrada).toMatchObject({
          eventType: 'treeRiskDetected',
          aggregateType: 'TREE_SURVEY',
          aggregateId: SURVEY,
        });
      },
    );

    /**
     * El relevamiento se guarda igual: el censo registra todo, el bus solo se
     * entera de lo que le puede caer a alguien encima.
     */
    it.each([RiskLevel.LOW, RiskLevel.MEDIUM])(
      'un riesgo %s se guarda pero no publica nada',
      async (riskLevel) => {
        await service.create(TREE, dto({ riskLevel }));

        expect(prisma.treeSurvey.create).toHaveBeenCalledTimes(1);
        expect(outbox.enqueue).not.toHaveBeenCalled();
      },
    );

    it('el evento y el relevamiento van en la misma transacción', async () => {
      await service.create(TREE, dtoAlto({ riskLevel: RiskLevel.CRITICAL }));

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const [tx] = outbox.enqueue.mock.calls[0];
      expect(tx).toBe(prisma);
    });

    /**
     * El hecho ocurrió cuando el inspector miró el árbol, no cuando cargó la
     * planilla. El dispatcher barre en orden de ocurrencia.
     */
    it('el evento ocurre en la fecha del relevamiento, no en la de carga', async () => {
      await service.create(TREE, dtoAlto());

      const [, entrada] = outbox.enqueue.mock.calls[0];
      expect(entrada.occurredAt).toEqual(new Date('2026-08-20T10:00:00.000Z'));
    });

    it('la fecha llega como string y se guarda como Date', async () => {
      await service.create(TREE, dto());

      expect(prisma.treeSurvey.create.mock.calls[0][0].data.surveyedAt).toBeInstanceOf(Date);
    });
  });

  describe('listado por árbol', () => {
    it('siempre acota al árbol y filtra por salud y riesgo', async () => {
      await service.findAllByTree(TREE, {
        page: 1,
        pageSize: 20,
        healthStatus: 'DISEASED',
        riskLevel: RiskLevel.HIGH,
      } as any);

      expect(prisma.treeSurvey.findMany.mock.calls[0][0].where).toEqual({
        treeId: TREE,
        healthStatus: 'DISEASED',
        riskLevel: RiskLevel.HIGH,
      });
    });

    /** El historial se lee de lo más reciente hacia atrás. */
    it('ordena del relevamiento más nuevo al más viejo', async () => {
      await service.findAllByTree(TREE, { page: 1, pageSize: 20 } as any);

      expect(prisma.treeSurvey.findMany.mock.calls[0][0].orderBy).toEqual({ surveyedAt: 'desc' });
    });

    it('un árbol inexistente da 404', async () => {
      prisma.tree.findUnique.mockResolvedValue(null);

      await expect(
        service.findAllByTree(TREE, { page: 1, pageSize: 20 } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findOne', () => {
    /** Un relevamiento de otro árbol no se devuelve por acertar el id. */
    it('busca el relevamiento dentro del árbol, no suelto', async () => {
      await service.findOne(TREE, SURVEY);

      expect(prisma.treeSurvey.findFirst).toHaveBeenCalledWith({
        where: { id: SURVEY, treeId: TREE },
      });
    });

    it('un relevamiento que no es de ese árbol da 404', async () => {
      prisma.treeSurvey.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TREE, SURVEY)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
