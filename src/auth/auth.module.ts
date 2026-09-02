import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

/**
 * Registra la estrategia JWT que usa el JwtAuthGuard global.
 *
 * No emite tokens: la identidad es de otro módulo (M9/M1, sin definir).
 * Acá solo los verificamos.
 */
@Module({
  imports: [PassportModule],
  providers: [JwtStrategy],
})
export class AuthModule {}
