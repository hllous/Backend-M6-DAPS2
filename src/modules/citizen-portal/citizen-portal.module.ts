import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { crearGetTracker } from './client-tracker';
import { CitizenPortalController } from './citizen-portal.controller';
import { CitizenPortalService } from './citizen-portal.service';
import { CONSULTA } from './rate-limits';

@Module({
  // El límite se registra solo en este módulo. Uno global también alcanzaría a
  // un operador municipal en su turno, y un 429 a mitad de una carga de
  // resultados de zona es peor que el riesgo que evita.
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [CONSULTA],
        getTracker: crearGetTracker(config.get<string>('bffSharedKey')),
      }),
    }),
  ],
  controllers: [CitizenPortalController],
  providers: [CitizenPortalService],
})
export class CitizenPortalModule {}
