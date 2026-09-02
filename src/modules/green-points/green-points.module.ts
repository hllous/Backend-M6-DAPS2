import { Module } from '@nestjs/common';
import { GreenPointsController } from './green-points.controller';
import { GreenPointsService } from './green-points.service';

@Module({
  controllers: [GreenPointsController],
  providers: [GreenPointsService],
  exports: [GreenPointsService],
})
export class GreenPointsModule {}
