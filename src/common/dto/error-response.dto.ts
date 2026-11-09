import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO estándar de error para documentar @ApiResponse de errores.
 * Problem Details RFC 9457 (ADR-011) + los campos históricos de §5.3, que se
 * mantienen por compatibilidad. Se sirve como `application/problem+json`.
 */
export class ErrorResponseDto {
  @ApiProperty({
    example: 'about:blank',
    description:
      'RFC 9457: URI que identifica el tipo de problema; "about:blank" si no hay uno propio',
  })
  type: string;

  @ApiProperty({ example: 'Not Found', description: 'RFC 9457: frase estándar del status' })
  title: string;

  @ApiProperty({ example: 404, description: 'RFC 9457: código HTTP (igual a statusCode)' })
  status: number;

  @ApiProperty({
    example: 'Container with id 123e4567-... not found',
    description: 'RFC 9457: explicación legible (igual a message)',
  })
  detail: string;

  @ApiProperty({
    example: '/containers/123e4567-e89b-12d3-a456-426614174000',
    description: 'RFC 9457: ruta de la request, con tokens de la query redactados (igual a path)',
  })
  instance: string;

  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({ example: 'Container with id 123e4567-... not found' })
  message: string;

  @ApiProperty({ example: 'Not Found' })
  error: string;

  @ApiPropertyOptional({
    example: 'ROLE_REQUIRED',
    description:
      'Código estable, solo en algunos errores: ROLE_REQUIRED (403 por falta de rol de M6) o NOT_ASSIGNED (403 por pertenencia: el recurso no es de su cuadrilla ni se le asignó)',
  })
  code?: string;

  @ApiProperty({ example: '2026-08-20T10:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/containers/123e4567-e89b-12d3-a456-426614174000' })
  path: string;
}
