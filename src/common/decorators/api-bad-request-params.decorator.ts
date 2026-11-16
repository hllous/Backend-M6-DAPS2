import { ApiBadRequestResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';

/**
 * Documenta el 400 de un GET o de un POST de transición con parámetros: el
 * ParseUUIDPipe del id de ruta o el ValidationPipe global del query (whitelist + forbidNonWhitelisted) lo
 * lanzan ante un valor mal formado o una propiedad no declarada. Sin esto el
 * contrato calla un código que el backend sí devuelve (DEF-20); lo exige
 * openapi-contract.spec para todo GET con parámetros.
 */
export const ApiBadRequestParams = () =>
  ApiBadRequestResponse({
    description:
      'Parámetro de ruta o de query inválido (UUID mal formado, valor fuera de rango o propiedad no declarada)',
    type: ErrorResponseDto,
  });
