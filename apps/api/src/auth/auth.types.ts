import type { Role } from '@barakahfi/shared';
import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export type AuthenticatedRequest = Request & { user: JwtPayload };
