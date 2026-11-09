import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { FinancialDataProvider, StoredFinancialDataProvider } from './financial-data.provider';
import { ScreenerController } from './screener.controller';
import { ScreenerService } from './screener.service';

@Module({
  imports: [RealtimeModule],
  controllers: [ScreenerController],
  providers: [
    ScreenerService,
    { provide: FinancialDataProvider, useClass: StoredFinancialDataProvider },
  ],
  exports: [ScreenerService],
})
export class ScreenerModule {}
