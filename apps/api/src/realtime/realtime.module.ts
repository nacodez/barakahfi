import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MarketModule } from '../market/market.module';
import { AlertsService } from './alerts.service';
import { PriceTicker } from './price-ticker.service';
import { RealtimeController } from './realtime.controller';
import { RealtimeGateway } from './realtime.gateway';
import { TicketService } from './ticket.service';

@Module({
  imports: [JwtModule.register({}), MarketModule],
  controllers: [RealtimeController],
  providers: [AlertsService, TicketService, RealtimeGateway, PriceTicker],
  exports: [AlertsService, PriceTicker],
})
export class RealtimeModule {}
