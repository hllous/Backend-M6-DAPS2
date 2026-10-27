import { PrismaService } from '../../prisma/prisma.service';
import { NeighborhoodsCatalogService } from '../../core/neighborhoods-catalog.service';
import { CommunesController } from './communes.controller';
import { CommunesService } from './communes.service';

describe('CommunesService / Controller', () => {
  const prisma = { commune: { findMany: jest.fn() } };
  const catalog = { list: jest.fn() };
  const service = new CommunesService(
    prisma as unknown as PrismaService,
    catalog as unknown as NeighborhoodsCatalogService,
  );

  const comuna = {
    id: 'c-1',
    code: 'comuna-14',
    name: 'Comuna 14',
    active: true,
    zones: [
      { id: 'z-1', code: 'palermo', name: 'Palermo', neighborhoods: [{ neighborhoodId: 'b-1' }] },
    ],
  };

  beforeEach(() => {
    prisma.commune.findMany.mockReset().mockResolvedValue([comuna]);
    catalog.list.mockReset().mockReturnValue([{ id: 'b-1', codigo: 'palermo', nombre: 'Palermo' }]);
  });

  it('arma comuna > zonas > barrios con codigo y nombre del catálogo', async () => {
    const res = await new CommunesController(service).findAll({});

    expect(res).toEqual([
      {
        id: 'c-1',
        code: 'comuna-14',
        name: 'Comuna 14',
        active: true,
        zones: [
          {
            id: 'z-1',
            code: 'palermo',
            name: 'Palermo',
            neighborhoods: [{ id: 'b-1', codigo: 'palermo', nombre: 'Palermo' }],
          },
        ],
      },
    ]);
    expect(prisma.commune.findMany.mock.calls[0][0].where).toEqual({});
  });

  it('filtra por active y, sin catálogo, deja solo el id del barrio', async () => {
    catalog.list.mockReturnValue([]);

    const res = await service.findAll({ active: false });

    expect(prisma.commune.findMany.mock.calls[0][0].where).toEqual({ active: false });
    expect(res[0].zones[0].neighborhoods).toEqual([
      { id: 'b-1', codigo: undefined, nombre: undefined },
    ]);
  });
});
