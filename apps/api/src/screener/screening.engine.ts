import {
  BORDERLINE_FRACTION,
  SCREENING_THRESHOLDS,
  type ComplianceStatus,
  type ScreeningCheckDto,
} from '@barakahfi/shared';
import { D, type DecimalLike } from '../common/decimal.util';
import { Prisma } from '../generated/prisma/client';

export interface ScreeningInput {
  /** Business activity screen: is the company's main business permissible? */
  primaryActivity: 'PERMISSIBLE' | 'PROHIBITED';
  prohibitedReason?: string;
  debtRatio: DecimalLike;
  cashRatio: DecimalLike;
  /** Null when the data source doesn't provide it. */
  receivablesRatio: DecimalLike | null;
  haramRevenueRatio: DecimalLike;
  /** Where non-compliant revenue comes from; informational. */
  sources?: string[];
}

export interface ScreeningOutcome {
  status: ComplianceStatus;
  checks: ScreeningCheckDto[];
  /** Fraction of dividends to donate (0 for non-compliant stocks). */
  purificationPercent: Prisma.Decimal;
  explanation: string;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function ratioCheck(
  key: ScreeningCheckDto['key'],
  label: string,
  raw: DecimalLike | null,
  limit: number,
): ScreeningCheckDto {
  if (raw === null) {
    return { key, label, value: null, threshold: limit, passed: null, note: 'No data available' };
  }
  const value = D(raw);
  return { key, label, value: value.toNumber(), threshold: limit, passed: value.lt(limit) };
}

/**
 * Two layers, as in the AAOIFI standard:
 *  1. Business activity: a prohibited main business is non-compliant outright.
 *  2. Financial ratios and non-compliant revenue: each must be strictly under its limit.
 * Passing everything but sitting near a limit (or missing data) is "doubtful".
 * Purification is the share of non-compliant revenue, owed on dividends of compliant/doubtful stocks.
 */
export function screen(input: ScreeningInput): ScreeningOutcome {
  const t = SCREENING_THRESHOLDS;
  const prohibited = input.primaryActivity === 'PROHIBITED';

  const checks: ScreeningCheckDto[] = [
    {
      key: 'BUSINESS_ACTIVITY',
      label: 'Main business is permissible',
      value: null,
      threshold: null,
      passed: !prohibited,
      ...(prohibited && input.prohibitedReason ? { note: input.prohibitedReason } : {}),
    },
    ratioCheck('DEBT', 'Interest-bearing debt / market cap', input.debtRatio, t.debt),
    ratioCheck(
      'CASH',
      'Cash and interest-bearing securities / market cap',
      input.cashRatio,
      t.cash,
    ),
    ratioCheck(
      'RECEIVABLES',
      'Receivables and cash / market cap',
      input.receivablesRatio,
      t.receivables,
    ),
    ratioCheck(
      'HARAM_REVENUE',
      'Non-compliant revenue / total revenue',
      input.haramRevenueRatio,
      t.haramRevenue,
    ),
  ];

  const failed = checks.filter((c) => c.passed === false);
  const missing = checks.filter((c) => c.passed === null);
  const borderline = checks.filter(
    (c) =>
      c.passed === true &&
      c.value !== null &&
      c.threshold !== null &&
      D(c.value).gte(D(c.threshold).mul(BORDERLINE_FRACTION)),
  );

  let status: ComplianceStatus;
  let explanation: string;
  if (prohibited) {
    status = 'NON_COMPLIANT';
    explanation = `Fails the business activity screen: ${input.prohibitedReason ?? 'the main business is not permissible'}.`;
  } else if (failed.length > 0) {
    status = 'NON_COMPLIANT';
    explanation = `Fails: ${failed.map((c) => `${c.label.toLowerCase()} is ${pct(c.value!)} (must be under ${pct(c.threshold!)})`).join('; ')}.`;
  } else if (missing.length > 0 || borderline.length > 0) {
    status = 'DOUBTFUL';
    const reasons = [
      ...missing.map((c) => `${c.label.toLowerCase()} has no data`),
      ...borderline.map(
        (c) =>
          `${c.label.toLowerCase()} is ${pct(c.value!)}, close to the ${pct(c.threshold!)} limit`,
      ),
    ];
    explanation = `Passes every screen but ${reasons.join('; ')}.`;
  } else {
    status = 'COMPLIANT';
    explanation = 'Passes the business activity screen and every financial ratio screen.';
  }

  const purificationPercent = status === 'NON_COMPLIANT' ? D(0) : D(input.haramRevenueRatio);
  if (status !== 'NON_COMPLIANT' && purificationPercent.gt(0)) {
    explanation += ` Donate ${pct(purificationPercent.toNumber())} of dividends to purify.`;
  }

  return { status, checks, purificationPercent, explanation };
}

/** Dividends x purification share, rounded to cents. 3% of 100.00 is 3.00. */
export function purificationAmount(dividends: DecimalLike, percent: DecimalLike): Prisma.Decimal {
  return D(dividends).mul(percent).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
