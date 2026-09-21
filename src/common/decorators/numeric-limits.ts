// Topes numericos que salen del tipo de columna (Int4, Decimal(10,2), etc.).
// Cada uno alimenta a `@Max` y al `maximum` del swagger: el repo no usa el
// plugin de Swagger, asi que el rango validado no se refleja solo (#196).
export const MAX_INT32 = 2147483647;
// Decimal(10,2)
export const MAX_DECIMAL_10_2 = 99999999.99;
// Decimal(5,2)
export const MAX_TREE_HEIGHT_M = 999.99;
// Decimal(5,1)
export const MAX_TREE_DIAMETER_CM = 9999.9;
// 10.000.000 x MAX_PAGE_SIZE queda dentro del Int32 de `skip` de Prisma.
export const MAX_PAGE = 10000000;
export const MAX_PAGE_SIZE = 100;
// 1 = Lunes ... 7 = Domingo
export const MIN_WEEKDAY = 1;
export const MAX_WEEKDAY = 7;
