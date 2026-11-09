/**
 * AAOIFI-style screening limits, as stated in the product spec. All ratios are fractions
 * (0.30 = 30%). A value must be strictly BELOW its limit to pass.
 */
export const SCREENING_THRESHOLDS = {
  /** Interest-bearing debt / market cap. */
  debt: 0.3,
  /** (Cash + interest-bearing securities) / market cap. */
  cash: 0.3,
  /** (Receivables + cash) / market cap. */
  receivables: 0.67,
  /** Revenue from non-compliant activities / total revenue. */
  haramRevenue: 0.05,
} as const;

/**
 * This app's own rule for "doubtful": every screen passes but a ratio sits within 10% of its
 * limit (i.e. at 90% of it or more), or a figure is missing. The standards don't define this.
 */
export const BORDERLINE_FRACTION = 0.9;

export const ComplianceStatus = {
  COMPLIANT: 'COMPLIANT',
  NON_COMPLIANT: 'NON_COMPLIANT',
  DOUBTFUL: 'DOUBTFUL',
} as const;
export type ComplianceStatus = (typeof ComplianceStatus)[keyof typeof ComplianceStatus];

export const AssetType = {
  STOCK: 'STOCK',
  ETF: 'ETF',
  SUKUK: 'SUKUK',
  GOLD: 'GOLD',
  REAL_ESTATE: 'REAL_ESTATE',
  CRYPTO: 'CRYPTO',
} as const;
export type AssetType = (typeof AssetType)[keyof typeof AssetType];

/** Screening rows with this source are illustrative placeholders, not real screening results. */
export const SAMPLE_DATA_SOURCE = 'demo-seed';

export type CheckKey = 'BUSINESS_ACTIVITY' | 'DEBT' | 'CASH' | 'RECEIVABLES' | 'HARAM_REVENUE';

/** One line of the verdict breakdown shown in the UI. `passed: null` means no data. */
export interface ScreeningCheckDto {
  key: CheckKey;
  label: string;
  /** Ratio as a fraction; null for the business-activity check or missing data. */
  value: number | null;
  threshold: number | null;
  passed: boolean | null;
  note?: string;
}
