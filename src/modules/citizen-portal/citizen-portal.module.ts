import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { crearGetTracker } from './client-tracker';
import { CitizenPortalController } from './citizen-portal.controller';
import { CitizenPortalService } from './citizen-portal.service';
import { CONSULTA } from './rate-limits';

@Module({
  // Límite propio del portal (más estricto que el global de AppModule, #568).
  // Las rutas /public/* pasan por los dos guards, cada uno con su contador; no
  // se les pone @SkipThrottle porque el guard local lee el mismo metadato.
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
