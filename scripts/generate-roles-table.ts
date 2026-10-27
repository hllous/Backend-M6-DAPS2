/**
 * Regenera la tabla "Rol por endpoint" de docs/api/endpoints.md desde la
 * metadata de @Roles/@Public. Un spec (route-roles.spec.ts) falla si el
 * archivo queda desincronizado. Se corre con `npm run docs:roles`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import {
  listRoutes,
  ROLES_TABLE_END,
  ROLES_TABLE_START,
  rolesTable,
} from '../src/auth/route-roles';

const ARCHIVO = join(__dirname, '..', 'docs', 'api', 'endpoints.md');

const doc = readFileSync(ARCHIVO, 'utf-8');
const crlf = doc.includes('\r\n');
const texto = doc.replace(/\r\n/g, '\n');
const ini = texto.indexOf(ROLES_TABLE_START);
const fin = texto.indexOf(ROLES_TABLE_END);
if (ini < 0 || fin < 0)
  throw new Error('Faltan los marcadores roles:start/roles:end en endpoints.md');

const nuevo =
  texto.slice(0, ini) +
  rolesTable(listRoutes(AppModule)) +
  texto.slice(fin + ROLES_TABLE_END.length);
writeFileSync(ARCHIVO, crlf ? nuevo.replace(/\n/g, '\r\n') : nuevo, 'utf-8');
console.log('docs/api/endpoints.md: tabla de roles regenerada');
