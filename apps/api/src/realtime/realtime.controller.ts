import { Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { RealtimeTicketDto } from '@barakahfi/shared';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TicketService } from './ticket.service';

@ApiTags('realtime')
@Controller('realtime')
export class RealtimeController {
  constructor(private readonly tickets: TicketService) {}

  /** Exchange the login session for a 60-second pass to open a WebSocket. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('ticket')
  ticket(@CurrentUser() user: JwtPayload): Promise<RealtimeTicketDto> {
    return this.tickets.issue(user.sub);
  }
}
