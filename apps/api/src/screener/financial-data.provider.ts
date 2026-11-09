import { Injectable } from '@nestjs/common';
import type { ScreeningInput } from './screening.engine';

/**
 * Source of the financial figures a screening is based on. The default just returns what is
 * already stored. In production, implement this against Musaffa, Zoya or IdealRatings and
 * return their fresh numbers; the screener will re-screen and record any change.
 */
export abstract class FinancialDataProvider {
  abstract fetch(asset: { symbol: string }, stored: ScreeningInput): Promise<ScreeningInput>;
}

@Injectable()
export class StoredFinancialDataProvider extends FinancialDataProvider {
  fetch(_asset: { symbol: string }, stored: ScreeningInput): Promise<ScreeningInput> {
    return Promise.resolve(stored);
  }
}
