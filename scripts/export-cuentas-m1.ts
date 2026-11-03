/**
 * Exporta a CSV las cuentas de empleado que M1 tiene que crear para el seed (#488):
 * las 12 de login (10000–10011) y los integrantes de las cuadrillas (todos EMPLEADO, decisión
 * del PO del 2/11). Columnas = las de `cuenta_empleado` de M1; `uuid` va vacío (lo genera M1).
 * La contraseña no viaja en el CSV: se acuerda por privado.
 *
 * Uso: `npm run m1:export-cuentas > cuentas-m1.csv`
 */
import { CREWS, nombreDePersona } from '../prisma/seed';

const ROL_DE_M1: Record<string, string> = {
  '10000': 'RESPONSABLE_AREA',
  '10001': 'RESPONSABLE_AREA',
  '10007': 'AUDITOR',
  '10008': 'AUDITOR',
};

const ids = new Set<string>(Array.from({ length: 12 }, (_, i) => String(10000 + i)));
for (const c of CREWS) [c.leaderUserId, ...c.members].forEach((id) => ids.add(id));

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const filas = ['empleado_id,mail,nombre_empleado,apellido_empleado,rol,activo,uuid'];
for (const id of [...ids].sort((a, b) => Number(a) - Number(b))) {
  const [nombre, ...apellido] = nombreDePersona(id).split(' ');
  const mail = `${sinAcentos(nombre)}.${sinAcentos(apellido.join(''))}.${id}@municipio.gob.ar`;
  filas.push(
    [id, mail, nombre, apellido.join(' '), ROL_DE_M1[id] ?? 'ADMINISTRATIVO', 'TRUE', ''].join(','),
  );
}
console.log(filas.join('\n'));
