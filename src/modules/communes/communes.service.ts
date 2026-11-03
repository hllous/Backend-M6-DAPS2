import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NeighborhoodsCatalogService } from '../../core/neighborhoods-catalog.service';
import { CommuneResponseDto, QueryCommunesDto } from './dto';

@Injectable()
export class CommunesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: NeighborhoodsCatalogService,
  ) {}

  /** Comunas con sus zonas y barrios. Sin catálogo de M9 los barrios llevan solo el id. */
  async findAll(query: QueryCommunesDto): Promise<CommuneResponseDto[]> {
    const communes = await this.prisma.commune.findMany({
      where: query.active === undefined ? {} : { active: query.active },
      // `code` desempata: el número no es único en la base.
      orderBy: [{ number: 'asc' }, { code: 'asc' }],
      include: {
        zones: { orderBy: { code: 'asc' }, include: { neighborhoods: true } },
      },
    });
    const catalogo = new Map(this.catalog.list().map((b) => [b.id, b]));

    return communes.map((c) => ({
      id: c.id,
      code: c.code,
      number: c.number,
      name: c.name,
      active: c.active,
      zones: c.zones.map((z) => ({
        id: z.id,
        code: z.code,
        name: z.name,
        neighborhoods: z.neighborhoods.map((n) => {
          const b = catalogo.get(n.neighborhoodId);
          return { id: n.neighborhoodId, codigo: b?.codigo, nombre: b?.nombre };
        }),
      })),
    }));
  }
}
