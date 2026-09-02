import { Module } from '@nestjs/common';
import {
  RepairRequestsController,
  StreetClosureRequestsController,
} from './outbound-requests.controller';
import { OutboundRequestsService } from './outbound-requests.service';

@Module({
  controllers: [RepairRequestsController, StreetClosureRequestsController],
  providers: [OutboundRequestsService],
  exports: [OutboundRequestsService],
})
export class OutboundRequestsModule {}
