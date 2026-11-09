import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { RealtimeTicketDto } from '@barakahfi/shared';
import type { Env } from '../config/env';

const TICKET_TTL_SECONDS = 60;

/**
 * Short-lived, single-purpose pass for opening a WebSocket. In production the web app and the API
 * live on different sites, so the browser's login cookie never reaches the socket handshake.
 * The signed-in client asks for a ticket over normal HTTP (which does carry the cookie) and
 * presents it when connecting. It is signed with a DIFFERENT key from login tokens, so a ticket
 * can never be used as an API credential and vice versa.
 */
@Injectable()
export class TicketService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get secret(): string {
    return `${this.config.get('JWT_ACCESS_SECRET', { infer: true })}:realtime`;
  }

  async issue(userId: string): Promise<RealtimeTicketDto> {
    const ticket = await this.jwt.signAsync(
      { sub: userId, use: 'realtime' },
      { secret: this.secret, expiresIn: TICKET_TTL_SECONDS },
    );
    return { ticket, expiresInSeconds: TICKET_TTL_SECONDS };
  }

  async verify(ticket: unknown): Promise<string> {
    if (typeof ticket !== 'string') throw new UnauthorizedException('Missing ticket');
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; use: string }>(ticket, {
        secret: this.secret,
      });
      if (payload.use !== 'realtime') throw new Error('wrong purpose');
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired ticket');
    }
  }
}
