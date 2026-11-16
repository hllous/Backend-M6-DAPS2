import { execFileSync } from 'node:child_process';

/**
 * La colección Postman de test/api/ cubre las operaciones del OpenAPI con un caso de éxito y uno de
 * error, salvo las excepciones justificadas de test/api/excepciones.json (#697). Corre el mismo
 * script que el job `api` del workflow api-tests, así un endpoint nuevo sin caso falla ya en `npm test`.
 */
describe('cobertura de la colección Postman (scripts/check-api-coverage.mjs)', () => {
  it('toda operación del OpenAPI tiene caso de éxito y de error, o una excepción con motivo', () => {
    const salida = execFileSync(process.execPath, ['scripts/check-api-coverage.mjs'], {
      encoding: 'utf8',
    });
    expect(salida).toMatch(/API: \d+ operaciones; éxito \d+\/\d+/);
  });
});
