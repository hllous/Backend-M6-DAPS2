import { ServiceUnavailableException } from '@nestjs/common';
import { NeighborhoodsCatalogService } from '../../core/neighborhoods-catalog.service';
import { NeighborhoodsController } from './neighborhoods.controller';
import { NeighborhoodsService } from './neighborhoods.service';

const BARRIO = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  codigo: 'palermo',
  nombre: 'Palermo',
  zona: 'comuna-14',
  zonaNombre: 'Comuna 14',
  activo: true,
};

describe('NeighborhoodsService / Controller', () => {
  const catalog = { disponible: true, list: jest.fn().mockReturnValue([BARRIO]) };
  const service = new NeighborhoodsService(catalog as unknown as NeighborhoodsCatalogService);

  it('mapea el catálogo cacheado y pasa los filtros', () => {
    const res = new NeighborhoodsController(service).findAll({ soloActivos: true, q: 'pal' });

    expect(catalog.list).toHaveBeenCalledWith({ soloActivos: true, q: 'pal' });
    expect(res).toEqual([{ ...BARRIO, metadatos: null }]);
  });

  it('sin catálogo responde 503, no una lista vacía', () => {
    catalog.disponible = false;
    expect(() => service.findAll({})).toThrow(ServiceUnavailableException);
  });
});
