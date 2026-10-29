import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssignCrewDto } from './assign-crew.dto';
import { CreateServiceDto } from './create-service.dto';
import { UpdateServiceDto } from './update-service.dto';

const CREW = '33333333-3333-4333-8333-333333333333';

/** La nota es la justificación de un override: diez espacios no justifican nada. */
describe('overrideNote de la asignación', () => {
  const casos: [string, new () => object, object][] = [
    ['AssignCrewDto', AssignCrewDto, { crewId: CREW }],
    ['CreateServiceDto', CreateServiceDto, {}],
    ['UpdateServiceDto', UpdateServiceDto, {}],
  ];

  const errorEnNota = async (Dto: new () => object, base: object, overrideNote: string) =>
    (await validate(plainToInstance(Dto, { ...base, overrideNote }))).some(
      (e) => e.property === 'overrideNote',
    );

  it.each(casos)('%s: diez espacios no cumplen el mínimo', async (_n, Dto, base) => {
    expect(await errorEnNota(Dto, base, ' '.repeat(10))).toBe(true);
  });

  it.each(casos)('%s: el mínimo se cuenta sin los bordes', async (_n, Dto, base) => {
    expect(await errorEnNota(Dto, base, '   corta   ')).toBe(true);
    expect(await errorEnNota(Dto, base, '  coordinado por radio  ')).toBe(false);
  });
});
