/** Every API response uses this envelope: { data, meta, error }. */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

export interface OffsetMeta {
  page: number;
  limit: number;
  total: number;
}

export interface CursorMeta {
  nextCursor: string | null;
  limit: number;
}

export interface ApiResponse<T, M = Record<string, unknown> | null> {
  data: T | null;
  meta: M | null;
  error: ApiError | null;
}

/** Money is serialized as a string to avoid IEEE-754 rounding (e.g. "1250.50"). */
export type Money = string;

export interface UserDto {
  id: string;
  email: string;
  name: string;
  currency: string;
  role: 'USER' | 'ADMIN';
  emailVerified: boolean;
  nisabMethod: 'GOLD' | 'SILVER';
  /** Start of the user's zakat year (hawl), YYYY-MM-DD. */
  zakatStartDate: string | null;
}

export interface CategoryDto {
  id: string;
  name: string;
  type: import('./enums').CategoryType;
  icon: string;
  halalStatus: import('./enums').HalalStatus;
  /** System categories (shared by everyone) can't be edited. */
  isSystem: boolean;
}

export interface TransactionDto {
  id: string;
  type: import('./enums').TransactionType;
  amount: Money;
  description: string;
  /** Calendar date, YYYY-MM-DD (no time zone). */
  date: string;
  accountId: string;
  accountName: string;
  currency: string;
  transferAccountId: string | null;
  transferAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryHalalStatus: import('./enums').HalalStatus | null;
  createdAt: string;
}

/** Totals for one currency over a date range (transfers excluded). */
export interface TransactionSummaryDto {
  currency: string;
  income: Money;
  expense: Money;
  net: Money;
}

export interface BudgetDto {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  period: import('./enums').BudgetPeriod;
  amount: Money;
  spent: Money;
  remaining: Money;
  /** spent / amount, one decimal place; can exceed 100. */
  percent: number;
  status: import('./enums').BudgetStatus;
  startDate: string;
  /** The calendar window the spend was counted over (end is exclusive). */
  windowStart: string;
  windowEnd: string;
}

export interface MonthlyTotalDto {
  /** YYYY-MM */
  month: string;
  income: Money;
  expense: Money;
}

export interface AssetDto {
  id: string;
  symbol: string;
  name: string;
  type: import('./screening').AssetType;
  exchange: string | null;
  sector: string | null;
  currency: string;
  price: Money;
  previousClose: Money | null;
  /** Approximate market capitalisation in US dollars. */
  marketCapUsd: string | null;
  lastUpdated: string;
}

export interface ScreeningDto {
  status: import('./screening').ComplianceStatus;
  checks: import('./screening').ScreeningCheckDto[];
  explanation: string;
  /** Share of dividends to donate, as a fraction (0.03 = 3%). */
  purificationPercent: number;
  haramRevenueSources: string[];
  screenedAt: string;
  source: string;
  /** True when the figures are illustrative placeholders rather than a real screening. */
  isSample: boolean;
}

export interface ScreenerRowDto {
  asset: AssetDto;
  status: import('./screening').ComplianceStatus;
  debtRatio: number;
  cashRatio: number;
  haramRevenueRatio: number;
  purificationPercent: number;
  screenedAt: string;
  isSample: boolean;
}

export interface ScreenerDetailDto {
  asset: AssetDto;
  screening: ScreeningDto;
  /** Newest first. A row exists only where the verdict or the numbers changed. */
  history: Array<{
    status: import('./screening').ComplianceStatus;
    screenedAt: string;
    source: string;
  }>;
  /** True if the stored result was fresh (under 24h old) and no re-screening ran. */
  cached: boolean;
}

export interface ScreenerFiltersDto {
  exchanges: string[];
  sectors: string[];
}

/** Amounts marked "native" are in the asset's own currency; "Base" ones in the user's default currency. */
export interface HoldingDto {
  id: string;
  assetId: string;
  symbol: string;
  name: string;
  exchange: string | null;
  currency: string;
  quantity: string;
  avgBuyPrice: Money;
  purchaseDate: string;
  accountId: string | null;
  dividendsReceived: Money;
  currentPrice: Money;
  previousClose: Money | null;
  priceUpdatedAt: string;
  /** native */
  value: Money;
  cost: Money;
  gainLoss: Money;
  gainLossPercent: number;
  dayChange: Money;
  valueBase: Money;
  /** Share of the whole portfolio, by base value. */
  allocationPercent: number;
  status: import('./screening').ComplianceStatus | null;
  purificationPercent: number;
  /** native: dividends received x purification share. */
  purificationDue: Money;
  isSample: boolean;
}

export interface PortfolioTotalsDto {
  /** The user's default currency; every figure below is in it. */
  currency: string;
  value: Money;
  cost: Money;
  gainLoss: Money;
  gainLossPercent: number;
  dayChange: Money;
  dayChangePercent: number;
  purificationDue: Money;
}

export interface PortfolioDto {
  totals: PortfolioTotalsDto;
  rows: HoldingDto[];
}

export interface AccountDto {
  id: string;
  name: string;
  type: import('./enums').AccountType;
  currency: string;
  balance: Money;
  isZakatable: boolean;
  archivedAt: string | null;
  createdAt: string;
}
