import { Module } from '@nestjs/common';
import { FxService } from './fx.service';
import { MetalsService } from './metals.service';
import { PriceProvider } from './price-provider';
import { YahooPriceProvider } from './yahoo-price.provider';

@Module({
  providers: [{ provide: PriceProvider, useClass: YahooPriceProvider }, FxService, MetalsService],
  exports: [PriceProvider, FxService, MetalsService],
})
export class MarketModule {}
