import { Module } from '@nestjs/common';
import { EnvironmentalReportsController } from './environmental-reports.controller';
import { EnvironmentalReportsService } from './environmental-reports.service';
import { ReportDeadlineSweeper } from './report-deadline.sweeper';

@Module({
  controllers: [EnvironmentalReportsController],
  providers: [EnvironmentalReportsService, ReportDeadlineSweeper],
  exports: [EnvironmentalReportsService],
})
export class EnvironmentalReportsModule {}
