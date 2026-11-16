import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryContainersDto } from '../../modules/containers/dto/query-containers.dto';
import { QueryCrewsDto } from '../../modules/crews/dto/query-crews.dto';
import { QueryGreenPointsDto } from '../../modules/green-points/dto/query-green-points.dto';
import { QueryGreenSpacesDto } from '../../modules/green-spaces/dto/query-green-spaces.dto';
import { QueryRoutesDto } from '../../modules/routes/dto/query-routes.dto';
import { QueryTreesDto } from '../../modules/trees/dto/query-trees.dto';
import { QueryVehiclesDto } from '../../modules/vehicles/dto/query-vehicles.dto';
import { SortablePaginationQueryDto, buildOrderBy } from './sort-query.dto';

type Caso = readonly [string, new () => SortablePaginationQueryDto, string];
const casos: readonly Caso[] = [
  ['vehicles', QueryVehiclesDto, 'plate'],
  ['containers', QueryContainersDto, 'code'],
  ['trees', QueryTreesDto, 'surveyCode'],
  ['crews', QueryCrewsDto, 'name'],
  ['routes', QueryRoutesDto, 'code'],
  ['green-points', QueryGreenPointsDto, 'name'],
  ['green-spaces', QueryGreenSpacesDto, 'spaceType'],
];

const props = async (cls: Caso[1], plain: object) =>
  (await validate(plainToInstance(cls, plain))).map((e) => e.property);

describe.each(casos)('sort/order de %s', (_nombre, cls, campo) => {
  it('acepta un campo de la lista y ambos sentidos', async () => {
    expect(await props(cls, { sort: campo, order: 'desc' })).toEqual([]);
    expect(await props(cls, { sort: campo, order: 'asc' })).toEqual([]);
  });

  it('sin parámetros es válido y order queda en asc', async () => {
    expect(await props(cls, {})).toEqual([]);
    expect(plainToInstance(cls, {}).order).toBe('asc');
  });

  it('rechaza un sort fuera de la lista (también una columna real no visible)', async () => {
    expect(await props(cls, { sort: 'id' })).toEqual(['sort']);
    expect(await props(cls, { sort: 'updatedAt; DROP' })).toEqual(['sort']);
  });

  it('rechaza un order inválido', async () => {
    expect(await props(cls, { order: 'up' })).toEqual(['order']);
  });
});

describe('buildOrderBy', () => {
  it('sin sort ni order conserva el orden por defecto, con id de desempate', () => {
    expect(buildOrderBy({}, 'plate')).toEqual([{ plate: 'asc' }, { id: 'asc' }]);
  });

  it('sort y order cambian campo y sentido; el desempate sigue el sentido', () => {
    expect(buildOrderBy({ sort: 'createdAt', order: 'desc' }, 'plate')).toEqual([
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('order solo invierte el campo por defecto', () => {
    expect(buildOrderBy({ order: 'desc' }, 'plate')).toEqual([{ plate: 'desc' }, { id: 'desc' }]);
  });
});
