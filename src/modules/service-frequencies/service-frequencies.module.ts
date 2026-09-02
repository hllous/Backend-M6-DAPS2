import { Module } from '@nestjs/common';
import { ServiceFrequenciesController } from './service-frequencies.controller';
import { ServiceFrequenciesService } from './service-frequencies.service';

@Module({
  controllers: [ServiceFrequenciesController],
  providers: [ServiceFrequenciesService],
  exports: [ServiceFrequenciesService],
})
export class ServiceFrequenciesModule {}
