import { Module } from '@nestjs/common';
import { CrewsController } from './crews.controller';
import { IdentityModule } from '../../identity/identity.module';
import { CrewsService } from './crews.service';

@Module({
  imports: [IdentityModule],
  controllers: [CrewsController],
  providers: [CrewsService],
  exports: [CrewsService],
})
export class CrewsModule {}
