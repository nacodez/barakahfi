import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { ZakatController } from './zakat.controller';
import { ZakatService } from './zakat.service';

@Module({ imports: [MarketModule], controllers: [ZakatController], providers: [ZakatService] })
export class ZakatModule {}
