import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { ScreenerDetailDto, ScreenerFiltersDto } from '@barakahfi/shared';
import { ScreenerQuery } from './dto/screener.dto';
import { ScreenerService } from './screener.service';

/** Screening can trigger a re-check against the data source, so it has its own tighter limit. */
@ApiTags('screener')
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('screener')
export class ScreenerController {
  constructor(private readonly screener: ScreenerService) {}

  @Get()
  search(@Query() query: ScreenerQuery) {
    return this.screener.search(query);
  }

  // Before ':symbol' so "filters" is never treated as a ticker.
  @Get('filters')
  filters(): Promise<ScreenerFiltersDto> {
    return this.screener.filters();
  }

  @Get(':symbol')
  detail(@Param('symbol') symbol: string): Promise<ScreenerDetailDto> {
    return this.screener.screenStock(symbol);
  }
}
