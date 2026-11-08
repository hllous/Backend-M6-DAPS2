import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators';
import { ErrorResponseDto } from '../common/dto';
import { BusStatus } from '../events/bus-status';
import { PrismaService } from '../prisma/prisma.service';
import { HealthResponseDto, ReadinessResponseDto } from './health-response.dto';

const SERVICE = 'm6-ambiente-backend';
const DB_TIMEOUT_MS = 3000;

// Lo consultan el keepalive de GitHub y el healthcheck de Render: un 429 los daría por caídos.
@SkipThrottle()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: BusStatus,
  ) {}

  // Liveness: no toca la base a propósito. Lo usa el keepalive de GitHub y no
  // debe fallar (ni tardar) por un problema de la base.
  @Get()
  @Public()
  @ApiOperation({
    summary: 'Health check (liveness)',
    description:
      'Devuelve OK si el proceso está corriendo. No consulta la base: para eso está /health/ready.',
  })
  @ApiResponse({ status: 200, description: 'Servicio activo', type: HealthResponseDto })
  check(): HealthResponseDto {
    return { status: 'ok', timestamp: new Date().toISOString(), service: SERVICE };
  }

  @Get('ready')
  @Public()
  @ApiOperation({
    summary: 'Readiness: verifica la conexión a la base',
    description:
      'Ejecuta un SELECT 1 con un timeout de 3 s. Responde 503 si la base no contesta; es el endpoint para monitoreo. Informa también el estado del bus (`broker`), pero un bus caído no cambia el código: la API sigue sirviendo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio y base disponibles',
    type: ReadinessResponseDto,
  })
  @ApiResponse({ status: 503, description: 'La base no responde', type: ErrorResponseDto })
  async ready(): Promise<ReadinessResponseDto> {
    let timer: NodeJS.Timeout | undefined;
    try {
      // ponytail: el SELECT 1 colgado NO se cancela y sigue ocupando una conexión del
      // pool de Prisma hasta que la base o el driver la cierren; con la base caída y un
      // monitor consultando seguido pueden acumularse. Mitigación: connection_limit o
      // pool_timeout en DATABASE_URL.
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS);
        }),
      ]);
    } catch {
      // Sin detalle del error: el mensaje de la base puede traer host o usuario.
      throw new ServiceUnavailableException('Base de datos no disponible');
    } finally {
      clearTimeout(timer);
    }
    // El bus es informativo a propósito: el consumidor reconecta solo y la API no
    // depende de él para servir, así que no entra en el 503.
    return {
      status: 'ok',
      database: 'up',
      broker: this.bus.state,
      timestamp: new Date().toISOString(),
      service: SERVICE,
    };
  }
}
