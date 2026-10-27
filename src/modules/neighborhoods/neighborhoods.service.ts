import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { NeighborhoodsCatalogService } from '../../core/neighborhoods-catalog.service';
import { NeighborhoodResponseDto, QueryNeighborhoodsDto } from './dto';

@Injectable()
export class NeighborhoodsService {
  constructor(private readonly catalog: NeighborhoodsCatalogService) {}

  /**
   * Sirve el catálogo cacheado. Sin catálogo es 503 y no una lista vacía: una
   * lista vacía se leería como "M9 no tiene barrios".
   */
  findAll(query: QueryNeighborhoodsDto): NeighborhoodResponseDto[] {
    if (!this.catalog.disponible) {
      throw new ServiceUnavailableException(
        'El catálogo de barrios de M9 todavía no está disponible; reintentar más tarde',
      );
    }
    return this.catalog.list(query).map((b) => ({
      id: b.id,
      codigo: b.codigo,
      nombre: b.nombre,
      zona: b.zona,
      zonaNombre: b.zonaNombre,
      metadatos: b.metadatos ?? null,
      activo: b.activo,
    }));
  }
}
