import { Module } from '@nestjs/common';
import { CommunesController } from './communes.controller';
import { CommunesService } from './communes.service';

// PrismaService y el catálogo de barrios (CoreModule) son globales.
@Module({
  controllers: [CommunesController],
  providers: [CommunesService],
})
export class CommunesModule {}
