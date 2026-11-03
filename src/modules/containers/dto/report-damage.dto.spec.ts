import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReportDamageDto } from './report-damage.dto';

const base = { damageType: 'LID_BROKEN', severity: 'MEDIUM' };

/** Las observaciones son texto libre e interno: opcionales, recortadas y con tope. */
describe('ReportDamageDto.observations', () => {
  const errorEnObservaciones = async (observations?: unknown) =>
    (await validate(plainToInstance(ReportDamageDto, { ...base, observations }))).some(
      (e) => e.property === 'observations',
    );

  it('es opcional', async () => {
    expect(await errorEnObservaciones(undefined)).toBe(false);
  });

  it('acepta 500 caracteres y rechaza 501', async () => {
    expect(await errorEnObservaciones('a'.repeat(500))).toBe(false);
    expect(await errorEnObservaciones('a'.repeat(501))).toBe(true);
  });

  it('rechaza el texto vacío o de solo espacios', async () => {
    expect(await errorEnObservaciones('')).toBe(true);
    expect(await errorEnObservaciones('   ')).toBe(true);
  });

  it('recorta los espacios de los extremos', async () => {
    const dto = plainToInstance(ReportDamageDto, { ...base, observations: '  tapa rota  ' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.observations).toBe('tapa rota');
  });

  it('rechaza un valor que no es texto', async () => {
    expect(await errorEnObservaciones(123)).toBe(true);
  });
});
