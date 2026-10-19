import { Global, Module } from '@nestjs/common';
import { CoreClient } from './core.client';

/** Global como PrismaModule: el cliente del Core es uno solo para toda la app. */
@Global()
@Module({
  providers: [CoreClient],
  exports: [CoreClient],
})
export class CoreModule {}
