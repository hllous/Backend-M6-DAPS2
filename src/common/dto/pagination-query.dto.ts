import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_PAGE, MAX_PAGE_SIZE } from '../decorators/numeric-limits';

/**
 * DTO de query params para paginación.
 * Se extiende en los Query DTOs de cada módulo.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    default: 1,
    minimum: 1,
    maximum: MAX_PAGE,
    description: 'Página (1-indexed)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  // 10.000.000 x pageSize (100) queda dentro del Int32 de `skip` de Prisma.
  @Max(MAX_PAGE)
  page: number = 1;

  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    description: 'Registros por página',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = 20;

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }

  get take(): number {
    return this.pageSize;
  }
}
