import { SAMPLE_DATA_SOURCE, type AssetDto, type ScreeningDto } from '@barakahfi/shared';
import type { Asset, ScreeningResult } from '../generated/prisma/client';
import type { ScreeningInput } from './screening.engine';
import { screen } from './screening.engine';

/** The shape stored in ScreeningResult.revenueScreening. */
export interface RevenueScreening {
  haramRevenueRatio: string;
  sources: string[];
  primaryActivity: 'PERMISSIBLE' | 'PROHIBITED';
  prohibitedReason?: string;
}

export const revenueOf = (row: Pick<ScreeningResult, 'revenueScreening'>): RevenueScreening =>
  row.revenueScreening as unknown as RevenueScreening;

/** Rebuild the engine input from a stored row. */
export function inputFromRow(row: ScreeningResult): ScreeningInput {
  const rev = revenueOf(row);
  return {
    primaryActivity: rev.primaryActivity,
    ...(rev.prohibitedReason ? { prohibitedReason: rev.prohibitedReason } : {}),
    debtRatio: row.debtRatio,
    cashRatio: row.cashRatio,
    receivablesRatio: row.receivablesRatio,
    haramRevenueRatio: rev.haramRevenueRatio,
    sources: rev.sources,
  };
}

export function toAssetDto(a: Asset): AssetDto {
  return {
    id: a.id,
    symbol: a.symbol,
    name: a.name,
    type: a.type,
    exchange: a.exchange,
    sector: a.sector,
    currency: a.currency,
    price: a.currentPrice.toFixed(),
    previousClose: a.previousClose?.toFixed() ?? null,
    marketCapUsd: a.marketCap?.toFixed(0) ?? null,
    lastUpdated: a.lastUpdated.toISOString(),
  };
}

/** Checks and explanation are recomputed from the stored numbers so they always match the current rules. */
export function toScreeningDto(row: ScreeningResult): ScreeningDto {
  const outcome = screen(inputFromRow(row));
  return {
    status: row.complianceStatus,
    checks: outcome.checks,
    explanation: outcome.explanation,
    purificationPercent: row.purificationPercent.toNumber(),
    haramRevenueSources: revenueOf(row).sources ?? [],
    screenedAt: row.screenedAt.toISOString(),
    source: row.source,
    isSample: row.source === SAMPLE_DATA_SOURCE,
  };
}
