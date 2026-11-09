import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { REALTIME_EVENTS, type PricesEventDto } from '@barakahfi/shared';
import type { Subscription } from 'rxjs';
import type { Server, Socket } from 'socket.io';
import { AlertsService } from './alerts.service';
import { TicketService } from './ticket.service';

const room = (userId: string) => `user:${userId}`;

/**
 * Pushes live prices and alerts to browsers. Every connection is authenticated with a ticket
 * and placed in a private room named after its user, so nobody can receive another user's data.
 * CORS is configured in app.setup.ts (it needs the validated env).
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayConnection, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() private server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);
  private sub?: Subscription;

  constructor(
    private readonly tickets: TicketService,
    private readonly alerts: AlertsService,
  ) {}

  onModuleInit(): void {
    this.sub = this.alerts.events$.subscribe(({ userIds, alert }) => {
      for (const id of userIds) this.server?.to(room(id)).emit(REALTIME_EVENTS.alerts, alert);
    });
  }

  onModuleDestroy(): void {
    this.sub?.unsubscribe();
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const auth = client.handshake.auth as { ticket?: unknown } | undefined;
      const userId = await this.tickets.verify(auth?.ticket);
      client.data = { userId };
      await client.join(room(userId));
      client.emit('ready');
    } catch {
      this.logger.debug('Rejected an unauthenticated socket');
      client.emit('unauthorized');
      client.disconnect(true);
    }
  }

  /** Users with at least one open connection; the ticker only fetches prices for these. */
  connectedUserIds(): string[] {
    const rooms = this.server?.sockets.adapter.rooms;
    if (!rooms) return [];
    return [...rooms.keys()]
      .filter((r) => r.startsWith('user:'))
      .map((r) => r.slice('user:'.length));
  }

  emitPrices(userId: string, payload: PricesEventDto): void {
    this.server?.to(room(userId)).emit(REALTIME_EVENTS.prices, payload);
  }
}
