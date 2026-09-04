import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { CitizenPortalController } from './citizen-portal.controller';
import { CitizenPortalService } from './citizen-portal.service';
import { CONSULTA } from './rate-limits';

@Module({
  // El límite se registra solo en este módulo. Uno global también alcanzaría a
  // un operador municipal en su turno, y un 429 a mitad de una carga de
  // resultados de zona es peor que el riesgo que evita.
  imports: [ThrottlerModule.forRoot([CONSULTA])],
  controllers: [CitizenPortalController],
  providers: [CitizenPortalService],
})
export class CitizenPortalModule {}
