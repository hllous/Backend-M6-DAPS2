import { Global, Module } from '@nestjs/common';
import { CoreClient } from './core.client';
import { CoreRegistryService } from './core-registry.service';

/** Global como PrismaModule: el cliente del Core es uno solo para toda la app. */
@Global()
@Module({
  providers: [CoreClient, CoreRegistryService],
  exports: [CoreClient],
})
export class CoreModule {}
