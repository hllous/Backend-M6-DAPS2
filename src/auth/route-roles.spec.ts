import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../app.module';
import { isWrite, listRoutes, ROLES_TABLE_END, ROLES_TABLE_START, rolesTable } from './route-roles';
import { M6_ROLES, M6Role } from './m6-role';

/**
 * Red de seguridad de #161: recorre TODOS los handlers de TODOS los controllers
 * (por metadata, sin levantar la app) para que una escritura nueva sin @Roles,
 * o con un rol inventado, rompa el build en vez de quedar abierta o inservible.
 */
const RUTAS_ESPERADAS = 148;

describe('cobertura de @Roles por ruta', () => {
  const routes = listRoutes(AppModule);
  const label = (r: { method: string; path: string }) => `${r.method} ${r.path}`;

  // Exacta a propósito: una ruta nueva obliga a tocar este número y, de paso, a
  // mirar la tabla de roles. Una ruta que el escaneo no ve haría bajar el número.
  it('encuentra todas las rutas de la app', () => {
    expect(routes).toHaveLength(RUTAS_ESPERADAS);
  });

  it('@AnyEmployee (sin rol de M6) está solo en GET /me', () => {
    expect(routes.filter((r) => r.anyEmployee).map(label)).toEqual(['GET /me']);
  });

  it('los GET con @Roles explícito son los esperados (lo demás exige cualquier rol de M6)', () => {
    const gets = routes
      .filter((r) => r.method === 'GET' && !r.isPublic && r.roles?.length)
      .map((r) => `${label(r)} -> ${r.roles}`);
    expect(gets).toEqual([
      'GET /environmental-inspections/:id/violation-notice -> M6_ADMIN,M6_OFICINA_AMBIENTAL,M6_CAMPO_INSPECTOR,M6_AUDITOR',
      'GET /events/outbox -> M6_ADMIN,M6_AUDITOR',
      'GET /events/outbox/:id -> M6_ADMIN',
      'GET /evidence -> M6_ADMIN,M6_OFICINA_OPERACIONES,M6_OFICINA_AMBIENTAL,M6_AUDITOR,M6_CAMPO_CUADRILLA,M6_CAMPO_INSPECTOR',
      'GET /role-assignments -> M6_ADMIN',
      'GET /role-assignments/:userId -> M6_ADMIN',
    ]);
  });

  it('toda escritura no pública declara @Roles', () => {
    const sinRoles = routes
      .filter((r) => isWrite(r.method) && !r.isPublic && !r.roles?.length)
      .map(label);
    expect(sinRoles).toEqual([]);
  });

  it('todo @Roles usa solo valores de M6Role', () => {
    const validos = new Set<string>(M6_ROLES);
    const invalidos = routes
      .filter((r) => r.roles?.some((x) => !validos.has(x)))
      .map((r) => `${label(r)} -> ${r.roles}`);
    expect(invalidos).toEqual([]);
  });

  it('M6_AUDITOR no aparece en ninguna escritura', () => {
    const conAuditor = routes
      .filter((r) => isWrite(r.method) && r.roles?.includes(M6Role.M6_AUDITOR))
      .map(label);
    expect(conAuditor).toEqual([]);
  });

  it('Oficina y Campo no se mezclan en un mismo @Roles, salvo las excepciones', () => {
    const campo: string[] = [M6Role.M6_CAMPO_CUADRILLA, M6Role.M6_CAMPO_INSPECTOR];
    const mezclados = routes
      .filter((r) => r.roles?.includes(M6Role.M6_ADMIN) && r.roles.some((x) => campo.includes(x)))
      .map(label);
    // Abrir expediente de oficio, el acta (la leen Ambiental y el inspector) y leer evidencia (todo M6).
    expect(mezclados).toEqual([
      'GET /environmental-inspections/:id/violation-notice',
      'POST /environmental-reports',
      'GET /evidence',
    ]);
  });

  it('POST /events/inbox es solo de M6_ADMIN', () => {
    const inbox = routes.find((r) => r.method === 'POST' && r.path === '/events/inbox');
    expect(inbox?.roles).toEqual([M6Role.M6_ADMIN]);
  });

  it('el outbox: el payload (detalle) y el reintento son solo de M6_ADMIN', () => {
    const rol = (m: string, p: string) => routes.find((r) => r.method === m && r.path === p)?.roles;
    expect(rol('GET', '/events/outbox/:id')).toEqual([M6Role.M6_ADMIN]);
    expect(rol('POST', '/events/outbox/:id/retry')).toEqual([M6Role.M6_ADMIN]);
    expect(rol('POST', '/events/outbox/retry-failed')).toEqual([M6Role.M6_ADMIN]);
  });

  it('solo los públicos esperados saltean la autorización', () => {
    expect(routes.filter((r) => r.isPublic).map(label)).toEqual([
      'GET /health',
      'GET /health/ready',
      'GET /public/green-points',
      'GET /public/reports/:ticketId',
      'GET /public/services',
      'GET /public/zones',
    ]);
  });

  it('la tabla de docs/api/endpoints.md está al día (npm run docs:roles)', () => {
    const doc = readFileSync(join(__dirname, '../../docs/api/endpoints.md'), 'utf-8').replace(
      /\r\n/g,
      '\n',
    );
    const ini = doc.indexOf(ROLES_TABLE_START);
    const fin = doc.indexOf(ROLES_TABLE_END);
    expect(ini).toBeGreaterThan(-1);
    expect(doc.slice(ini, fin + ROLES_TABLE_END.length)).toBe(rolesTable(routes));
  });
});
