import { Module } from '@nestjs/common';
import { GreenSpacesController } from './green-spaces.controller';
import { GreenSpacesService } from './green-spaces.service';

@Module({
  controllers: [GreenSpacesController],
  providers: [GreenSpacesService],
  exports: [GreenSpacesService],
})
export class GreenSpacesModule {}
