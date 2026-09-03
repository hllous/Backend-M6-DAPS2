import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

/**
 * Registra la estrategia JWT que usa el JwtAuthGuard global.
 *
 * No emite tokens: la identidad es de M1, que gestiona los usuarios de la
 * plataforma. Acá solo los verificamos.
 */
@Module({
  imports: [PassportModule],
  providers: [JwtStrategy],
})
export class AuthModule {}
