import { Module } from '@nestjs/common';
import { M1IdentityClient } from './m1-identity.client';
import { IdentityPort } from './identity.port';

/** Se inyecta por el puerto (`IdentityPort`); CoreClient llega del CoreModule global. */
@Module({
  providers: [M1IdentityClient, { provide: IdentityPort, useExisting: M1IdentityClient }],
  exports: [IdentityPort, M1IdentityClient],
})
export class IdentityModule {}
