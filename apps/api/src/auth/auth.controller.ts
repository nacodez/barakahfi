import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { UserDto } from '@barakahfi/shared';
import type { Request, Response } from 'express';
import type { Env } from '../config/env';
import { UsersService } from '../users/users.service';
import { REFRESH_COOKIE } from './auth.constants';
import { AuthService, type AuthResult } from './auth.service';
import type { JwtPayload } from './auth.types';
import { clearAuthCookies, setAuthCookies } from './cookies';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const readRefreshCookie = (req: Request) =>
  (req.cookies as Record<string, string | undefined> | undefined)?.[REFRESH_COOKIE];

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly secure: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    config: ConfigService<Env, true>,
  ) {
    this.secure = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserDto> {
    return this.respond(res, await this.auth.register(dto, req.get('user-agent')));
  }

  /** 5 attempts per minute per IP. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserDto> {
    return this.respond(res, await this.auth.login(dto, req.get('user-agent')));
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<UserDto> {
    try {
      return this.respond(
        res,
        await this.auth.refresh(readRefreshCookie(req), req.get('user-agent')),
      );
    } catch (e) {
      clearAuthCookies(res, this.secure);
      throw e;
    }
  }

  /** Public so a user with an expired access token can still end their session. */
  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<null> {
    await this.auth.logout(readRefreshCookie(req));
    clearAuthCookies(res, this.secure);
    return null;
  }

  @Get('me')
  async me(@CurrentUser() user: JwtPayload): Promise<UserDto> {
    return this.users.getProfile(user.sub);
  }

  private respond(res: Response, result: AuthResult): UserDto {
    setAuthCookies(res, result, this.secure);
    return result.user;
  }
}
