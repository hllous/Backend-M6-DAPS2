import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { M1RoleAdapter } from './m1-role.adapter';
import { MeController } from './me.controller';

/**
 * Registra la estrategia JWT que usa el JwtAuthGuard global.
 *
 * No emite tokens: la identidad es de M1, que gestiona los usuarios de la
 * plataforma. Acá solo los verificamos.
 */
@Module({
  imports: [PassportModule],
  controllers: [MeController],
  providers: [JwtStrategy, M1RoleAdapter],
  exports: [M1RoleAdapter],
})
export class AuthModule {}
