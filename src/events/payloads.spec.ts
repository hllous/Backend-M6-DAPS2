import * as fs from 'fs';
import * as path from 'path';
// Los schemas declaran draft 2020-12; el export por defecto de ajv es draft-07.
import Ajv2020 from 'ajv/dist/2020';
import type { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import {
  ContainerStatus,
  ContainerType,
  DamageType,
  RiskLevel,
  RiskType,
  ServiceCategory,
  ServiceMode,
  ServiceOrigin,
  ServiceStatus,
  Severity,
  TreeHealthStatus,
  TreeInterventionStatus,
  TreeInterventionType,
} from '@prisma/client';
import * as payloads from './payloads';

/**
 * Valida lo que emitimos contra los `.schema.json` que le circulamos a la
 * cohorte. Si un payload deja de coincidir con su contrato, esto falla acá y
 * no del lado del consumidor.
 */
const SCHEMA_DIR = path.join(__dirname, '../../docs/eventos/publicados');

const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
ajv.addSchema(
  JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, '_shared.schema.json'), 'utf-8')),
  '_shared.schema.json',
);

// ajv rechaza compilar dos veces un schema con el mismo $id, y varios tests
// validan contra el mismo evento.
const compilados = new Map<string, ValidateFunction>();

function validator(evento: string): ValidateFunction {
  let validate = compilados.get(evento);
  if (!validate) {
    validate = ajv.compile(
      JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, `${evento}.schema.json`), 'utf-8')),
    );
    compilados.set(evento, validate);
  }
  return validate;
}

function expectValido(evento: string, payload: unknown) {
  const validate = validator(evento);
  const ok = validate(payload);
  if (!ok) {
    throw new Error(
      `${evento} no valida contra su schema:\n` +
        (validate.errors ?? []).map((e) => `  ${e.instancePath || '/'} ${e.message}`).join('\n') +
        `\npayload: ${JSON.stringify(payload, null, 2)}`,
    );
  }
}

const ID = (n: number) => `${n}`.repeat(8) + '-1111-1111-1111-111111111111';

const serviceBase = {
  id: ID(1),
  serviceTypeId: ID(2),
  mode: ServiceMode.ROUTE,
  routeId: ID(3),
  targetType: null,
  targetId: null,
  scheduledDate: new Date('2026-09-15T00:00:00.000Z'),
  windowFrom: new Date('1970-01-01T08:00:00.000Z'),
  windowTo: new Date('1970-01-01T12:00:00.000Z'),
  crewId: ID(4),
  vehicleId: ID(5),
  status: ServiceStatus.SCHEDULED,
  statusReason: null,
  origin: ServiceOrigin.PLANNED,
  ticketId: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
  zones: [{ zoneId: ID(6) }],
} as never;

const serviceType = {
  id: ID(2),
  code: 'REC-DOM',
  name: 'Recolección domiciliaria',
  category: ServiceCategory.WASTE_COLLECTION,
  mode: ServiceMode.ROUTE,
  requiresVehicle: true,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} as never;

describe('payloads de los eventos publicados', () => {
  describe('urbanServiceScheduled', () => {
    it('valida con todos los campos', () => {
      expectValido(
        'urbanServiceScheduled',
        payloads.urbanServiceScheduled(serviceBase, serviceType),
      );
    });

    it('valida sin ventana horaria: en el modelo es opcional', () => {
      const sinVentana = { ...(serviceBase as object), windowFrom: null, windowTo: null } as never;
      const p = payloads.urbanServiceScheduled(sinVentana, serviceType);

      expect(p.timeWindow).toBeUndefined();
      expectValido('urbanServiceScheduled', p);
    });

    it('no manda routeId ni ticketId cuando no aplican', () => {
      const point = {
        ...(serviceBase as object),
        mode: ServiceMode.POINT,
        routeId: null,
        targetId: ID(7),
      } as never;
      const p = payloads.urbanServiceScheduled(point, serviceType);

      expect(p).not.toHaveProperty('routeId');
      expect(p).not.toHaveProperty('ticketId');
      expect(p.targetRef).toBe(ID(7));
      expectValido('urbanServiceScheduled', p);
    });
  });

  describe('containerDamaged', () => {
    const container = {
      id: ID(1),
      code: 'CT-0442',
      containerType: ContainerType.HOUSEHOLD,
      zoneId: ID(2),
      address: 'Av. Siempreviva 1000',
      lat: -34.6037,
      lng: -58.3816,
      capacityLiters: 1100,
      status: ContainerStatus.DAMAGED,
      damageType: DamageType.STRUCTURAL,
      severity: Severity.HIGH,
      requiresPublicWorks: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never;

    it('valida con ubicacion completa', () => {
      expectValido('containerDamaged', payloads.containerDamaged(container));
    });

    it('valida sin direccion: location queda vacio, no inventa datos', () => {
      const sinDir = { ...(container as object), address: null, lat: null, lng: null } as never;
      const p = payloads.containerDamaged(sinDir);

      expect(p.location).toEqual({});
      expectValido('containerDamaged', p);
    });

    it('nunca manda neighborhoodId: el catalogo es de M9 y no existe', () => {
      const p = payloads.containerDamaged(container);

      expect(p.location).not.toHaveProperty('neighborhoodId');
    });
  });

  describe('treeRiskDetected', () => {
    const tree = {
      id: ID(1),
      surveyCode: 'TR-00001',
      species: 'Fraxinus excelsior',
      zoneId: ID(2),
      address: 'Calle Falsa 200',
      lat: -34.6,
      lng: -58.4,
      heightM: null,
      diameterCm: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never;

    const survey = {
      id: ID(3),
      treeId: ID(1),
      surveyedAt: new Date('2026-09-01T14:00:00.000Z'),
      inspectorId: null,
      healthStatus: TreeHealthStatus.DISEASED,
      riskLevel: RiskLevel.HIGH,
      riskType: RiskType.FALLING_BRANCH,
      suggestedIntervention: TreeInterventionType.SAFETY_PRUNING,
      requiresStreetClosure: true,
      requiresPublicWorks: false,
      notes: null,
      createdAt: new Date(),
    } as never;

    it('valida con los enums del catalogo que fijo ADR-003', () => {
      const p = payloads.treeRiskDetected(tree, survey);

      expect(p.healthStatus).toBe('DISEASED');
      expect(p.suggestedIntervention).toBe('SAFETY_PRUNING');
      expectValido('treeRiskDetected', p);
    });

    it('valida sin especie: el censo admite un arbol sin identificar', () => {
      const p = payloads.treeRiskDetected({ ...(tree as object), species: null } as never, survey);

      expect(p).not.toHaveProperty('species');
      expectValido('treeRiskDetected', p);
    });

    it('valida sin intervencion sugerida: su ausencia significa monitorear', () => {
      const p = payloads.treeRiskDetected(tree, {
        ...(survey as object),
        suggestedIntervention: null,
      } as never);

      expect(p).not.toHaveProperty('suggestedIntervention');
      expectValido('treeRiskDetected', p);
    });
  });

  describe('treePruningScheduled', () => {
    const intervention = {
      id: ID(1),
      interventionType: TreeInterventionType.SAFETY_PRUNING,
      serviceId: ID(2),
      address: 'Calle Falsa 200',
      requiresStreetClosure: true,
      status: TreeInterventionStatus.AUTHORIZED,
      priority: null,
      authorizedByUserId: null,
      authorizedAt: null,
      justification: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      trees: [{ treeId: ID(3) }],
    } as never;

    const tree = {
      address: 'Calle Falsa 200',
      lat: -34.6,
      lng: -58.4,
    } as never;

    it('valida cuando el servicio ya tiene cuadrilla y franja', () => {
      const p = payloads.treePruningScheduled(intervention, serviceBase, tree);

      expect(p).not.toBeNull();
      expectValido('treePruningScheduled', p);
    });

    it('devuelve null si falta la cuadrilla: M7 la exige', () => {
      const sinCuadrilla = { ...(serviceBase as object), crewId: null } as never;

      expect(payloads.treePruningScheduled(intervention, sinCuadrilla, tree)).toBeNull();
    });

    it('devuelve null si falta la franja horaria: M7 la exige', () => {
      const sinVentana = { ...(serviceBase as object), windowFrom: null, windowTo: null } as never;

      expect(payloads.treePruningScheduled(intervention, sinVentana, tree)).toBeNull();
    });
  });

  describe('infrastructureRepairRequested', () => {
    const request = {
      id: ID(1),
      damageType: 'BLOCKED_DRAIN',
      severity: 'HIGH',
      publicSafetyRisk: true,
      detectedInType: 'SERVICE',
      detectedInId: ID(2),
      address: 'Rivadavia 4500',
      status: 'REQUESTED',
      workOrderId: null,
      requestedAt: new Date('2026-09-15T10:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never;

    it('valida la solicitud derivada a M3', () => {
      expectValido(
        'infrastructureRepairRequested',
        payloads.infrastructureRepairRequested(request),
      );
    });

    it('lleva el ticketId solo si el daño salio de un servicio con reclamo', () => {
      const con = payloads.infrastructureRepairRequested(request, 'TCK-2026-900');
      expect(con.ticketId).toBe('TCK-2026-900');
      expectValido('infrastructureRepairRequested', con);

      expect(payloads.infrastructureRepairRequested(request)).not.toHaveProperty('ticketId');
    });
  });

  describe('streetClosureRequested', () => {
    const closure = {
      id: ID(1),
      sourceType: 'TREE_INTERVENTION',
      sourceId: ID(2),
      reason: 'Extracción con riesgo de caída',
      closureFrom: new Date('2026-10-05T07:00:00.000Z'),
      closureTo: new Date('2026-10-05T13:00:00.000Z'),
      closureType: 'PARTIAL',
      status: 'REQUESTED',
      closureId: null,
      createdAt: new Date('2026-09-20T09:00:00.000Z'),
      updatedAt: new Date(),
      streets: [
        {
          id: 's1',
          requestId: ID(1),
          streetName: 'Rivadavia',
          fromCross: 'Mitre',
          toCross: 'San Martín',
        },
      ],
    } as never;

    it('valida la solicitud de corte con sourceModule = M6', () => {
      const p = payloads.streetClosureRequested(closure);

      expect(p.sourceModule).toBe('M6');
      expectValido('streetClosureRequested', p);
    });

    it('affectedSections nunca viaja vacio: el schema exige minItems 1', () => {
      const p = payloads.streetClosureRequested(closure);

      expect(p.affectedSections).toEqual(['Rivadavia entre Mitre y San Martín']);
    });
  });

  describe('environmentalViolationDetected', () => {
    const notice = {
      id: ID(1),
      noticeNumber: 'ACTA-2026-000012',
      inspectionId: ID(2),
      issuedAt: new Date('2026-09-10T12:00:00.000Z'),
      establishmentId: 'EST-004512',
      violationType: 'UNTREATED_DISCHARGE',
      severity: 'HIGH',
      suggestedAction: 'FINE',
      priorNoticeCount: 2,
      createdAt: new Date(),
    } as never;

    const adjunto = (url: string, contentType: string) =>
      ({
        id: ID(9),
        ownerType: 'INSPECTION',
        ownerId: ID(2),
        url,
        filename: 'medidor-frente.jpg',
        contentType,
        size: 1024,
        idempotencyKey: 'k',
        uploadedAt: new Date('2026-09-10T11:00:00.000Z'),
      }) as never;

    const inspection = { id: ID(2), reportId: ID(3) } as never;
    const report = {
      id: ID(3),
      address: 'Camino de Cintura 4500',
      lat: null,
      lng: null,
      ticketId: null,
    } as never;

    it('valida el acta derivada a M4', () => {
      const p = payloads.environmentalViolationDetected(notice, inspection, report);

      expect(p.priorNoticeCount).toBe(2);
      expect(p.evidence).toEqual([]);
      expectValido('environmentalViolationDetected', p);
    });

    /**
     * Nuestra tabla guarda `contentType`; el contrato define `evidence` como
     * `{url, mimeType}`. Son dos vocabularios distintos y el mapeo es el
     * trabajo de este builder.
     */
    it('mapea los adjuntos de la inspeccion a la forma que espera M4', () => {
      const p = payloads.environmentalViolationDetected(notice, inspection, report, [
        adjunto('https://cdn.example.com/e/1.jpg', 'image/jpeg'),
        adjunto('https://cdn.example.com/e/2.pdf', 'application/pdf'),
      ]);

      expect(p.evidence).toEqual([
        { url: 'https://cdn.example.com/e/1.jpg', mimeType: 'image/jpeg' },
        { url: 'https://cdn.example.com/e/2.pdf', mimeType: 'application/pdf' },
      ]);
      expectValido('environmentalViolationDetected', p);
    });

    /**
     * `evidence` es requerido en el schema: una inspeccion sin fotos manda la
     * lista vacia, no omite la clave.
     */
    it('sin adjuntos manda la lista vacia, no omite el campo', () => {
      const p = payloads.environmentalViolationDetected(notice, inspection, report, []);

      expect(p).toHaveProperty('evidence', []);
      expectValido('environmentalViolationDetected', p);
    });

    /** El nombre y el tamano son de M2, no de M4: su schema no los admite. */
    it('no manda el nombre ni el tamano, que son del contrato de M2', () => {
      const p = payloads.environmentalViolationDetected(notice, inspection, report, [
        adjunto('https://cdn.example.com/e/1.jpg', 'image/jpeg'),
      ]);

      const uno = (p.evidence as Record<string, unknown>[])[0];
      expect(Object.keys(uno).sort()).toEqual(['mimeType', 'url']);
    });

    it('lleva el ticketId solo si el expediente nacio de un reclamo', () => {
      const sinTicket = payloads.environmentalViolationDetected(notice, inspection, report);
      expect(sinTicket).not.toHaveProperty('ticketId');

      const conTicket = payloads.environmentalViolationDetected(notice, inspection, {
        ...(report as object),
        ticketId: 'TCK-2026-555',
      } as never);
      expect(conTicket.ticketId).toBe('TCK-2026-555');
      expectValido('environmentalViolationDetected', conTicket);
    });

    it('mantiene FORMAL_NOTICE, el valor que ADR-003 conservo contra el acuerdo', () => {
      const p = payloads.environmentalViolationDetected(
        { ...(notice as object), suggestedAction: 'FORMAL_NOTICE' } as never,
        inspection,
        report,
      );

      expect(p.suggestedAction).toBe('FORMAL_NOTICE');
      expectValido('environmentalViolationDetected', p);
    });
  });

  describe('updateTicketStatus', () => {
    it('valida un STARTED', () => {
      expectValido(
        'updateTicketStatus',
        payloads.updateTicketStatus({
          ticketId: 'TCK-2026-004821',
          updateType: 'STARTED',
          updatedById: 'user-001',
          publicMessage: 'La cuadrilla salió a atender su reclamo.',
        }),
      );
    });

    it('valida un RESOLVED con su details', () => {
      expectValido(
        'updateTicketStatus',
        payloads.updateTicketStatus({
          ticketId: 'TCK-2026-004821',
          updateType: 'RESOLVED',
          updatedById: 'user-001',
          details: { resolution: { type: 'ACTION_COMPLETED' } },
        }),
      );
    });

    it('valida un REJECTED con su cancellation', () => {
      expectValido(
        'updateTicketStatus',
        payloads.updateTicketStatus({
          ticketId: 'TCK-2026-004821',
          updateType: 'REJECTED',
          updatedById: 'user-001',
          internalMessage: 'Cancelado por alerta meteorológica',
          details: { cancellation: { reasonCode: 'OTHER' } },
        }),
      );
    });

    it('updatedBy va siempre como AREA_USER', () => {
      const p = payloads.updateTicketStatus({
        ticketId: 'TCK-1',
        updateType: 'PROGRESS',
        updatedById: 'user-009',
      });

      expect(p.updatedBy).toEqual({ type: 'AREA_USER', id: 'user-009' });
    });
  });
});
