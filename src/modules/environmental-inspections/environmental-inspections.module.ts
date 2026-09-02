import { Module } from '@nestjs/common';
import { EnvironmentalInspectionsController } from './environmental-inspections.controller';
import { EnvironmentalInspectionsService } from './environmental-inspections.service';
import { EnvironmentalReportsModule } from '../environmental-reports/environmental-reports.module';

@Module({
  imports: [EnvironmentalReportsModule],
  controllers: [EnvironmentalInspectionsController],
  providers: [EnvironmentalInspectionsService],
  exports: [EnvironmentalInspectionsService],
})
export class EnvironmentalInspectionsModule {}
