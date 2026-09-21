import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryVehiclesDto } from '../../modules/vehicles/dto/query-vehicles.dto';
import { UpdateZoneDto } from '../../modules/zones/dto/update-zone.dto';

// Mismas opciones que el ValidationPipe de main.ts: el bug solo aparece con
// enableImplicitConversion.
const parse = async <T extends object>(cls: new () => T, plain: object) => {
  const dto = plainToInstance(cls, plain, { enableImplicitConversion: true });
  return { dto, errors: await validate(dto) };
};

describe('ToBoolean', () => {
  it.each([
    ['true', true],
    ['false', false],
    ['TRUE', true],
    ['False', false],
    [true, true],
    [false, false],
  ])('query: active=%p -> %p', async (input, expected) => {
    const { dto, errors } = await parse(QueryVehiclesDto, { active: input });
    expect(errors).toHaveLength(0);
    expect(dto.active).toBe(expected);
  });

  it.each([
    ['true', true],
    ['false', false],
    [true, true],
    [false, false],
  ])('body: active=%p -> %p', async (input, expected) => {
    const { dto, errors } = await parse(UpdateZoneDto, { active: input });
    expect(errors).toHaveLength(0);
    expect(dto.active).toBe(expected);
  });

  it.each(['0', '1', 'maybe', '', 0, 1])('rechaza %p con mensaje claro', async (input) => {
    const { errors } = await parse(QueryVehiclesDto, { active: input });
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isBoolean).toBe('active debe ser true o false');
  });

  it('ausente sigue siendo opcional', async () => {
    const { dto, errors } = await parse(QueryVehiclesDto, {});
    expect(errors).toHaveLength(0);
    expect(dto.active).toBeUndefined();
  });
});
