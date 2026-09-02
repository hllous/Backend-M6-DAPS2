import { Module } from '@nestjs/common';
import { ServiceTypesController } from './service-types.controller';
import { ServiceTypesService } from './service-types.service';

@Module({
  controllers: [ServiceTypesController],
  providers: [ServiceTypesService],
  exports: [ServiceTypesService],
})
export class ServiceTypesModule {}
