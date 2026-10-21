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
describe('cobertura de @Roles por ruta', () => {
  const routes = listRoutes(AppModule);
  const label = (r: { method: string; path: string }) => `${r.method} ${r.path}`;

  it('encuentra las rutas de la app', () => {
    expect(routes.length).toBeGreaterThan(100);
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

  it('Oficina y Campo no se mezclan en un mismo @Roles, salvo abrir expediente de oficio', () => {
    const campo: string[] = [M6Role.M6_CAMPO_CUADRILLA, M6Role.M6_CAMPO_INSPECTOR];
    const mezclados = routes
      .filter((r) => r.roles?.includes(M6Role.M6_ADMIN) && r.roles.some((x) => campo.includes(x)))
      .map(label);
    expect(mezclados).toEqual(['POST /environmental-reports']);
  });

  it('POST /events/inbox es solo de M6_ADMIN', () => {
    const inbox = routes.find((r) => r.method === 'POST' && r.path === '/events/inbox');
    expect(inbox?.roles).toEqual([M6Role.M6_ADMIN]);
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
