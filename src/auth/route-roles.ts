import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { ANY_EMPLOYEE_KEY, ROLES_KEY } from '../common/decorators/roles.decorator';

export interface RouteRoles {
  method: string;
  path: string;
  isPublic: boolean;
  anyEmployee: boolean;
  /** Efectivo: el @Roles del handler pisa al de la clase, igual que en el RolesGuard. */
  roles: string[] | undefined;
}

type Ctor = new (...args: never[]) => unknown;
type ModuleRef = Ctor | { module: Ctor };

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export const isWrite = (method: string) => WRITES.has(method);

const joinPath = (...parts: unknown[]) =>
  '/' +
  parts
    .flatMap((p) => (Array.isArray(p) ? p : [p]))
    .map((p) => String(p ?? '').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');

/**
 * Todas las rutas de la app con sus roles, leídas de la metadata de los
 * decoradores. No instancia nada (sin base ni DI): sirve para un spec y para
 * generar la tabla de docs/api/endpoints.md.
 */
export function listRoutes(root: Ctor): RouteRoles[] {
  const seen = new Set<Ctor>();
  const controllers = new Set<Ctor>();
  const visit = (ref: ModuleRef | undefined) => {
    if (!ref) return;
    const mod = 'module' in ref ? ref.module : ref;
    if (seen.has(mod)) return;
    seen.add(mod);
    for (const c of (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, mod) ?? []) as Ctor[]) {
      controllers.add(c);
    }
    for (const i of (Reflect.getMetadata(MODULE_METADATA.IMPORTS, mod) ?? []) as ModuleRef[]) {
      visit(i);
    }
    if ('module' in ref) {
      // Módulo dinámico: sus controllers/imports viven en el objeto, no en la clase.
      const dyn = ref as { controllers?: Ctor[]; imports?: ModuleRef[] };
      dyn.controllers?.forEach((c) => controllers.add(c));
      dyn.imports?.forEach(visit);
    }
  };
  visit(root);

  const routes: RouteRoles[] = [];
  for (const controller of controllers) {
    const proto = controller.prototype as Record<string, unknown>;
    const base = Reflect.getMetadata(PATH_METADATA, controller);
    for (const name of Object.getOwnPropertyNames(proto)) {
      const handler = proto[name];
      if (typeof handler !== 'function') continue;
      const verb = Reflect.getMetadata(METHOD_METADATA, handler);
      if (verb === undefined) continue;
      // getAllAndOverride: el valor del handler, y si no hay, el de la clase.
      const meta = <T>(key: string): T | undefined =>
        (Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, controller)) as
          T | undefined;
      routes.push({
        method: RequestMethod[verb as number],
        path: joinPath(base, Reflect.getMetadata(PATH_METADATA, handler)),
        isPublic: meta<boolean>(IS_PUBLIC_KEY) === true,
        anyEmployee: meta<boolean>(ANY_EMPLOYEE_KEY) === true,
        roles: meta<string[]>(ROLES_KEY),
      });
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

/** Qué se escribe en la columna "Rol" de endpoints.md para una ruta. */
export function roleLabel(r: RouteRoles): string {
  if (r.isPublic) return 'público';
  if (r.anyEmployee) return 'cualquier empleado';
  if (r.roles?.length) return r.roles.map((x) => `\`${x}\``).join(', ');
  return isWrite(r.method) ? 'nadie (falta @Roles)' : 'cualquier rol de M6';
}

export const ROLES_TABLE_START =
  '<!-- roles:start (generado por npm run docs:roles, no editar a mano) -->';
export const ROLES_TABLE_END = '<!-- roles:end -->';

export function rolesTable(routes: RouteRoles[]): string {
  const rows = routes.map(
    (r) => `| ${r.method} | \`${r.path.replace(/\|/g, '\\|')}\` | ${roleLabel(r)} |`,
  );
  return [
    ROLES_TABLE_START,
    '',
    '| Método | Ruta | Rol |',
    '| --- | --- | --- |',
    ...rows,
    '',
    ROLES_TABLE_END,
  ].join('\n');
}
