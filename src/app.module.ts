import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';

// Infraestructura
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { JwtAuthGuard } from './common/guards';

// Módulos de dominio
import { ZonesModule } from './modules/zones/zones.module';
import { ServiceTypesModule } from './modules/service-types/service-types.module';
import { DisposalSitesModule } from './modules/disposal-sites/disposal-sites.module';
import { RoutesModule } from './modules/routes/routes.module';
import { ServiceFrequenciesModule } from './modules/service-frequencies/service-frequencies.module';
import { CrewsModule } from './modules/crews/crews.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { ContainersModule } from './modules/containers/containers.module';
import { TreesModule } from './modules/trees/trees.module';
import { GreenSpacesModule } from './modules/green-spaces/green-spaces.module';
import { GreenPointsModule } from './modules/green-points/green-points.module';
import { ServicesModule } from './modules/services/services.module';
import { EnvironmentalReportsModule } from './modules/environmental-reports/environmental-reports.module';
import { EnvironmentalInspectionsModule } from './modules/environmental-inspections/environmental-inspections.module';
import { OutboundRequestsModule } from './modules/outbound-requests/outbound-requests.module';
import { CitizenPortalModule } from './modules/citizen-portal/citizen-portal.module';
import { WeatherAlertsModule } from './modules/weather-alerts/weather-alerts.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { IndicatorsModule } from './modules/indicators/indicators.module';

@Module({
  imports: [
    // ─── Config global ──────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // ─── Infraestructura ────────────────────────────
    PrismaModule,
    HealthModule,
    AuthModule,
    EventsModule,

    // ─── Dominios de negocio ────────────────────────
    ZonesModule,
    ServiceTypesModule,
    DisposalSitesModule,
    RoutesModule,
    ServiceFrequenciesModule,
    CrewsModule,
    VehiclesModule,
    ContainersModule,
    TreesModule,
    GreenSpacesModule,
    GreenPointsModule,
    ServicesModule,
    EnvironmentalReportsModule,
    EnvironmentalInspectionsModule,
    OutboundRequestsModule,
    CitizenPortalModule,
    WeatherAlertsModule,
    AttachmentsModule,
    IndicatorsModule,
  ],
  providers: [
    // Todo endpoint exige JWT por defecto. Los publicos se marcan con @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
