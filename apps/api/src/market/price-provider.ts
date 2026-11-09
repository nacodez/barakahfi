import { Prisma } from '../generated/prisma/client';

export interface Quote {
  symbol: string;
  price: Prisma.Decimal;
  previousClose: Prisma.Decimal | null;
  currency: string;
}

/**
 * Where live prices come from. The app depends on this abstract class, so swapping Yahoo for
 * Alpha Vantage or a paid feed is one new class plus one line in the module.
 */
export abstract class PriceProvider {
  /** Quotes for the symbols it could resolve. Missing symbols are simply absent from the map. */
  abstract quote(symbols: string[]): Promise<Map<string, Quote>>;
}
