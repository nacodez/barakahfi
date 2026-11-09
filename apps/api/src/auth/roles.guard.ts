import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@barakahfi/shared';
import type { AuthenticatedRequest } from './auth.types';
import { ROLES_KEY } from './decorators/roles.decorator';

/** Reads the role from the JWT payload: no DB query per request. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;
    const { user } = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!required.includes(user.role)) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
