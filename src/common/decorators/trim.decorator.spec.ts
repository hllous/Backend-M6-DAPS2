import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateZoneDto } from '../../modules/zones/dto/create-zone.dto';
import { UpdateZoneDto } from '../../modules/zones/dto/update-zone.dto';

// Mismas opciones que el ValidationPipe de main.ts.
const parse = async <T extends object>(cls: new () => T, plain: object) => {
  const dto = plainToInstance(cls, plain, { enableImplicitConversion: true });
  return { dto, errors: await validate(dto, { whitelist: true, forbidNonWhitelisted: true }) };
};

describe('Trim', () => {
  it('create: recorta los bordes', async () => {
    const { dto, errors } = await parse(CreateZoneDto, { code: '  QA-S1  ', name: ' Norte ' });
    expect(errors).toHaveLength(0);
    expect(dto.code).toBe('QA-S1');
    expect(dto.name).toBe('Norte');
  });

  it('create: string normal queda igual', async () => {
    const { dto, errors } = await parse(CreateZoneDto, { code: 'Z 1', name: 'Zona Norte' });
    expect(errors).toHaveLength(0);
    expect(dto.code).toBe('Z 1');
  });

  it('create: solo espacios da error', async () => {
    const { errors } = await parse(CreateZoneDto, { code: '   ', name: '   ' });
    expect(errors.map((e) => e.property).sort()).toEqual(['code', 'name']);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });

  it.each([123, true, ['a'], { a: 1 }])('create: no-string %p da error', async (v) => {
    const { errors } = await parse(CreateZoneDto, { code: v, name: 'ok' });
    expect(errors[0].constraints).toHaveProperty('isString');
  });

  it('update: recorta y rechaza solo espacios', async () => {
    const ok = await parse(UpdateZoneDto, { name: '  Sur ' });
    expect(ok.errors).toHaveLength(0);
    expect(ok.dto.name).toBe('Sur');
    const bad = await parse(UpdateZoneDto, { name: '  ' });
    expect(bad.errors[0].constraints).toHaveProperty('isNotEmpty');
  });

  it('update: ausente sigue siendo opcional', async () => {
    const { dto, errors } = await parse(UpdateZoneDto, {});
    expect(errors).toHaveLength(0);
    expect(dto.name).toBeUndefined();
  });
});
