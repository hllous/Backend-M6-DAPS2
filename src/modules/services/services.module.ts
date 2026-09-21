import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { EnvironmentalInspectionsModule } from '../environmental-inspections/environmental-inspections.module';

@Module({
  imports: [EnvironmentalInspectionsModule],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
