import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { HealthResponseDto } from './health-response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({
    summary: 'Health check',
    description: 'Devuelve OK si el servicio está corriendo.',
  })
  @ApiResponse({ status: 200, description: 'Servicio activo', type: HealthResponseDto })
  check(): HealthResponseDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'm6-ambiente-backend',
    };
  }
}
