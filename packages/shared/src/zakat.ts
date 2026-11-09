import { z } from 'zod';
import type { Money } from './api';
import type { ComplianceStatus } from './screening';

/** Nisab thresholds in grams of pure metal; the most widely used figures. */
export const NISAB_GOLD_GRAMS = 85;
export const NISAB_SILVER_GRAMS = 595;
export const ZAKAT_RATE = 0.025;
/** A lunar year is about 354.4 days; used to estimate when the hawl (zakat year) completes. */
export const HAWL_DAYS = 354;

export type NisabMethodName = 'GOLD' | 'SILVER';
export type ZakatItemKind =
  'ACCOUNT' | 'HOLDING' | 'CASH' | 'RECEIVABLES' | 'GOLD' | 'SILVER' | 'OTHER';

/** One line of the wealth breakdown. Amounts are in the user's default currency. */
export interface ZakatItemDto {
  kind: ZakatItemKind;
  label: string;
  amount: Money;
}

export interface ZakatCalculationDto {
  currency: string;
  nisabMethod: NisabMethodName;
  items: ZakatItemDto[];
  assetsTotal: Money;
  liabilities: Money;
  /** Assets minus liabilities, never below zero. */
  netWealth: Money;
  nisabGold: Money;
  nisabSilver: Money;
  /** The nisab for the chosen method. */
  nisabUsed: Money;
  meetsNisab: boolean;
  zakatDue: Money;
  rate: number;
  goldPricePerGram: Money;
  silverPricePerGram: Money;
  pricesAsOf: string;
  /** "cached" means the live price feed failed and the last known price was used. */
  pricesSource: 'live' | 'cached';
}

export interface ZakatContextDto {
  currency: string;
  nisabMethod: NisabMethodName;
  hijriYear: number;
  goldPricePerGram: Money;
  silverPricePerGram: Money;
  nisabGold: Money;
  nisabSilver: Money;
  pricesAsOf: string;
  pricesSource: 'live' | 'cached';
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    currency: string;
    balance: Money;
    balanceBase: Money;
    isZakatable: boolean;
  }>;
  holdings: Array<{
    id: string;
    symbol: string;
    name: string;
    currency: string;
    value: Money;
    valueBase: Money;
    status: ComplianceStatus | null;
  }>;
}

export interface ZakatRecordDto {
  id: string;
  hijriYear: number;
  currency: string;
  nisabMethod: NisabMethodName;
  totalAssets: Money;
  nisabValue: Money;
  zakatDue: Money;
  zakatPaid: Money;
  breakdown: ZakatCalculationDto;
  notes: string | null;
  calculatedAt: string;
}

export interface ZakatSummaryDto {
  currency: string;
  nisabMethod: NisabMethodName;
  /** From the user's profile; null until they set it. */
  hawlStartDate: string | null;
  hawlEndDate: string | null;
  /** Negative when the hawl has already completed. */
  daysRemaining: number | null;
  /** Zakat on accounts marked zakatable plus all holdings, with no liabilities. A guide, not a final figure. */
  estimatedZakat: Money;
  netWealth: Money;
  nisabUsed: Money;
  meetsNisab: boolean;
  hijriYear: number;
  latestRecord: { hijriYear: number; zakatDue: Money; zakatPaid: Money } | null;
}

const amount = z.string().regex(/^\d{1,13}(\.\d{1,2})?$/, 'Enter 0 or more, with up to 2 decimals');
const grams = z.string().regex(/^\d{1,7}(\.\d{1,3})?$/, 'Enter grams, with up to 3 decimals');

/** What the wizard sends. Account and holding amounts are NOT sent: the server reads them itself. */
export const calculateZakatSchema = z.object({
  accountIds: z.array(z.uuid()).max(200).default([]),
  holdingIds: z.array(z.uuid()).max(200).default([]),
  cashOnHand: amount.default('0'),
  receivables: amount.default('0'),
  goldJewelryGrams: grams.default('0'),
  silverGrams: grams.default('0'),
  otherAssets: amount.default('0'),
  /** Debts due within the year. */
  liabilities: amount.default('0'),
  nisabMethod: z.enum(['GOLD', 'SILVER']).optional(),
});
export type CalculateZakatInput = z.input<typeof calculateZakatSchema>;

export const saveZakatSchema = calculateZakatSchema.extend({
  notes: z.string().trim().max(2000).optional(),
});
export type SaveZakatInput = z.input<typeof saveZakatSchema>;
