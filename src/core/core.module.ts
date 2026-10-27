import { Global, Module } from '@nestjs/common';
import { CoreClient } from './core.client';
import { CoreRegistryService } from './core-registry.service';
import { NeighborhoodsCatalogService } from './neighborhoods-catalog.service';

/** Global como PrismaModule: el cliente del Core es uno solo para toda la app. */
@Global()
@Module({
  providers: [CoreClient, CoreRegistryService, NeighborhoodsCatalogService],
  exports: [CoreClient, NeighborhoodsCatalogService],
})
export class CoreModule {}
