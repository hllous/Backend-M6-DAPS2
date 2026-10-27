import { M6Role } from '@prisma/client';

// Una sola definición: el enum nace en prisma/schema.prisma (lo usa la tabla de
// asignaciones) y se re-exporta acá para que el resto del código no importe Prisma.
export { M6Role };

export const M6_ROLES: readonly M6Role[] = Object.values(M6Role);

// ADR-005: Oficina y Campo son excluyentes (segregación de funciones). M6_ADMIN
// cuenta como Oficina ("más todo lo de Oficina"); M6_AUDITOR no es de ninguno.
export const OFICINA_ROLES: readonly M6Role[] = [
  M6Role.M6_ADMIN,
  M6Role.M6_OFICINA_OPERACIONES,
  M6Role.M6_OFICINA_AMBIENTAL,
];
export const CAMPO_ROLES: readonly M6Role[] = [
  M6Role.M6_CAMPO_CUADRILLA,
  M6Role.M6_CAMPO_INSPECTOR,
];
