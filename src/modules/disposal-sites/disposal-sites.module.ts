import { Module } from '@nestjs/common';
import { DisposalSitesController } from './disposal-sites.controller';
import { DisposalSitesService } from './disposal-sites.service';

@Module({
  controllers: [DisposalSitesController],
  providers: [DisposalSitesService],
  exports: [DisposalSitesService],
})
export class DisposalSitesModule {}
