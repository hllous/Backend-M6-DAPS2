import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { crearGetTracker } from './modules/citizen-portal/client-tracker';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';

// Infraestructura
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { CoreModule } from './core/core.module';
import { IdentityModule } from './identity/identity.module';
import { AuditModule } from './common/audit/audit.module';
import { JwtAuthGuard, RolesGuard } from './common/guards';

// Módulos de dominio
import { ZonesModule } from './modules/zones/zones.module';
import { NeighborhoodsModule } from './modules/neighborhoods/neighborhoods.module';
import { CommunesModule } from './modules/communes/communes.module';
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
import { RoleAssignmentsModule } from './modules/role-assignments/role-assignments.module';

@Module({
  imports: [
    // ─── Config global ──────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Límite global por IP. Mismo tracker que el portal: detrás del BFF, req.ip es la del BFF
    // y sin esto todos los usuarios compartirían balde.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.getOrThrow<number>('throttle.ttl'),
            limit: config.getOrThrow<number>('throttle.limit'),
          },
        ],
        getTracker: crearGetTracker(config.get<string>('bffSharedKey')),
      }),
    }),

    // ─── Infraestructura ────────────────────────────
    PrismaModule,
    HealthModule,
    AuthModule,
    EventsModule,
    CoreModule,
    IdentityModule,
    AuditModule,

    // ─── Dominios de negocio ────────────────────────
    ZonesModule,
    NeighborhoodsModule,
    CommunesModule,
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
    RoleAssignmentsModule,
  ],
  providers: [
    // Primero el límite de tasa: corta antes de gastar verificación de token en un abusador.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Todo endpoint exige JWT por defecto. Los publicos se marcan con @Public().
    // El orden importa: RolesGuard lee el usuario que deja JwtAuthGuard.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
