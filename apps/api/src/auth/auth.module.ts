import { Global, Module } from '@nestjs/common';
import { SessionService } from './session.service';

/**
 * Auth module — exposes `SessionService` for resolving the current
 * caller's session + role from an Express request. Declared global so
 * any feature module can inject the service without re-importing.
 */
@Global()
@Module({
  providers: [SessionService],
  exports: [SessionService],
})
export class AuthModule {}
