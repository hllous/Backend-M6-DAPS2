import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './jwt.strategy';
import { MeResponseDto } from './me.controller';
import { M6Role } from './m6-role';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async me({ userId, subType, m1Role, roles }: AuthenticatedUser): Promise<MeResponseDto> {
    // Misma pertenencia que `belongsToCrew` (ownership.ts): líder o integrante.
    // Solo id y nombre: nada de las demás personas de la cuadrilla.
    const found = await this.prisma.crew.findMany({
      where: { OR: [{ leaderUserId: userId }, { members: { some: { userId } } }] },
      select: { id: true, name: true, leaderUserId: true },
      orderBy: { name: 'asc' },
    });
    const crews = found.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.leaderUserId === userId ? ('LEADER' as const) : ('MEMBER' as const),
    }));
    return {
      userId,
      subType,
      m1Role,
      roles,
      crews,
      isAssignedInspector: roles.includes(M6Role.M6_CAMPO_INSPECTOR),
    };
  }
}
