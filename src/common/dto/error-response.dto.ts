import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO estándar de error para documentar @ApiResponse de errores.
 * Formato definido en docs/api/estandar-swagger.md §5.3.
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({ example: 'Container with id 123e4567-... not found' })
  message: string;

  @ApiProperty({ example: 'Not Found' })
  error: string;

  @ApiPropertyOptional({
    example: 'ROLE_REQUIRED',
    description: 'Código estable, solo en algunos errores (403 por falta de rol de M6)',
  })
  code?: string;

  @ApiProperty({ example: '2026-08-20T10:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/containers/123e4567-e89b-12d3-a456-426614174000' })
  path: string;
}
