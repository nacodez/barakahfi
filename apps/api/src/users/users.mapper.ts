import type { UserDto } from '@barakahfi/shared';
import type { User } from '../generated/prisma/client';

export function toUserDto(u: User): UserDto {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    currency: u.currency,
    role: u.role,
    emailVerified: u.emailVerifiedAt !== null,
  };
}
