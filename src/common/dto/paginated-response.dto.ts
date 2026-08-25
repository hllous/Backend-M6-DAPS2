import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO genérico para respuestas paginadas.
 * Formato definido en docs/api/estandar-swagger.md §5.2.
 */
export class PaginationMeta {
  @ApiProperty({ example: 142, description: 'Total de registros' })
  total: number;

  @ApiProperty({ example: 1, description: 'Página actual (1-indexed)' })
  page: number;

  @ApiProperty({ example: 20, description: 'Registros por página' })
  pageSize: number;

  @ApiProperty({ example: 8, description: 'Total de páginas' })
  totalPages: number;

  constructor(total: number, page: number, pageSize: number) {
    this.total = total;
    this.page = page;
    this.pageSize = pageSize;
    this.totalPages = Math.ceil(total / pageSize);
  }
}

export class PaginatedResponseDto<T> {
  data: T[];

  @ApiProperty({ type: PaginationMeta })
  meta: PaginationMeta;

  constructor(data: T[], total: number, page: number, pageSize: number) {
    this.data = data;
    this.meta = new PaginationMeta(total, page, pageSize);
  }
}
