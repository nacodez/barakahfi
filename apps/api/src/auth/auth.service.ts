import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { UserDto } from '@barakahfi/shared';
import * as argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toUserDto } from '../users/users.mapper';
import type { LoginDto, RegisterDto } from './dto/auth.dto';
import { TokenService } from './token.service';

export interface AuthResult {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
}

/** Verified against when the email is unknown so response time doesn't reveal which emails exist. */
const DUMMY_HASH = argon2.hash('barakahfi-timing-equaliser');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto, userAgent?: string): Promise<AuthResult> {
    const passwordHash = await argon2.hash(dto.password);
    try {
      const user = await this.prisma.user.create({
        data: { email: dto.email, name: dto.name, passwordHash },
      });
      return this.startSession(user, userAgent);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw e;
    }
  }

  async login(dto: LoginDto, userAgent?: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const valid = await argon2.verify(user?.passwordHash ?? (await DUMMY_HASH), dto.password);
    if (!user || !user.passwordHash || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.startSession(user, userAgent);
  }

  async refresh(rawRefreshToken: string | undefined, userAgent?: string): Promise<AuthResult> {
    if (!rawRefreshToken) throw new UnauthorizedException('Missing refresh token');
    const rotated = await this.tokens.rotate(rawRefreshToken, userAgent);
    const user = await this.prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user) throw new UnauthorizedException('Invalid refresh token');
    return {
      user: toUserDto(user),
      accessToken: await this.tokens.signAccess(user),
      refreshToken: rotated.token,
    };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken) await this.tokens.revokeFamilyByToken(rawRefreshToken);
  }

  private async startSession(
    user: Prisma.UserGetPayload<object>,
    userAgent?: string,
  ): Promise<AuthResult> {
    const [accessToken, refresh] = await Promise.all([
      this.tokens.signAccess(user),
      this.tokens.issueRefresh(user.id, userAgent),
    ]);
    return { user: toUserDto(user), accessToken, refreshToken: refresh.token };
  }
}
