import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({
    summary: 'Health check',
    description: 'Devuelve OK si el servicio está corriendo.',
  })
  @ApiResponse({ status: 200, description: 'Servicio activo' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'm6-ambiente-backend',
    };
  }
}
