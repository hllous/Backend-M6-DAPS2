import { Module } from '@nestjs/common';
import {
  RepairRequestsController,
  StreetClosureRequestsController,
} from './outbound-requests.controller';
import { OutboundRequestsService } from './outbound-requests.service';
import { StreetClosureExpirySweeper } from './street-closure-expiry.sweeper';

@Module({
  controllers: [RepairRequestsController, StreetClosureRequestsController],
  providers: [OutboundRequestsService, StreetClosureExpirySweeper],
  exports: [OutboundRequestsService],
})
export class OutboundRequestsModule {}
