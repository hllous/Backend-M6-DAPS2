import { Module } from '@nestjs/common';
import { CitizenPortalController } from './citizen-portal.controller';
import { CitizenPortalService } from './citizen-portal.service';

@Module({
  controllers: [CitizenPortalController],
  providers: [CitizenPortalService],
})
export class CitizenPortalModule {}
