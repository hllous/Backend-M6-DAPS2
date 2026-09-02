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
