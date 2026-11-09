import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ComplianceStatus,
  OffsetMeta,
  ScreenerDetailDto,
  ScreenerFiltersDto,
  ScreenerRowDto,
} from '@barakahfi/shared';
import { SAMPLE_DATA_SOURCE } from '@barakahfi/shared';
import { D } from '../common/decimal.util';
import { Prisma, type Asset, type ScreeningResult } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from '../realtime/alerts.service';
import type { ScreenerQuery } from './dto/screener.dto';
import { FinancialDataProvider } from './financial-data.provider';
import {
  inputFromRow,
  revenueOf,
  toAssetDto,
  toScreeningDto,
  type RevenueScreening,
} from './screener.mapper';
import { screen, type ScreeningInput } from './screening.engine';

/** A stored screening is reused for this long before it is re-checked against the data source. */
export const SCREENING_TTL_MS = 24 * 60 * 60 * 1000;

const SORT_SQL = {
  name: Prisma.sql`a.name`,
  symbol: Prisma.sql`a.symbol`,
  marketCap: Prisma.sql`a.market_cap`,
  debt: Prisma.sql`l.debt_ratio`,
  status: Prisma.sql`l.compliance_status`,
} as const;

interface SearchRow {
  id: string;
  symbol: string;
  name: string;
  type: Asset['type'];
  exchange: string | null;
  sector: string | null;
  currency: string;
  current_price: string;
  previous_close: string | null;
  market_cap: string | null;
  last_updated: Date;
  compliance_status: ComplianceStatus;
  debt_ratio: string;
  cash_ratio: string;
  revenue_screening: RevenueScreening;
  purification_percent: string;
  screened_at: Date;
  source: string;
  total: bigint;
}

/** Escape LIKE wildcards so a user typing "50%" searches for that text, not a pattern. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class ScreenerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialData: FinancialDataProvider,
    private readonly alerts: AlertsService,
  ) {}

  /**
   * Offset-paginated search over each asset's LATEST screening. `DISTINCT ON` picks the newest row
   * per asset and is served by the (asset_id, screened_at DESC) index.
   */
  async search(q: ScreenerQuery): Promise<{ data: ScreenerRowDto[]; meta: OffsetMeta }> {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const term = q.q?.trim();

    const where: Prisma.Sql[] = [];
    if (term) {
      const like = `%${likeEscape(term)}%`;
      where.push(Prisma.sql`(a.symbol ILIKE ${like} OR a.name ILIKE ${like})`);
    }
    if (q.status) where.push(Prisma.sql`l.compliance_status = ${q.status}::"ComplianceStatus"`);
    if (q.exchange) where.push(Prisma.sql`a.exchange = ${q.exchange}`);
    if (q.sector) where.push(Prisma.sql`a.sector = ${q.sector}`);
    if (q.minCapBn !== undefined) where.push(Prisma.sql`a.market_cap >= ${q.minCapBn * 1e9}`);
    if (q.maxCapBn !== undefined) where.push(Prisma.sql`a.market_cap <= ${q.maxCapBn * 1e9}`);

    const whereSql = where.length ? Prisma.sql`WHERE ${Prisma.join(where, ' AND ')}` : Prisma.empty;
    const direction = q.dir === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
    const order = Prisma.sql`${SORT_SQL[q.sort ?? 'name']} ${direction} NULLS LAST, a.symbol ASC`;

    const rows = await this.prisma.$queryRaw<SearchRow[]>`
      WITH latest AS (
        SELECT DISTINCT ON (asset_id) *
        FROM screening_results
        ORDER BY asset_id, screened_at DESC
      )
      SELECT a.id, a.symbol, a.name, a.type::text AS type, a.exchange, a.sector, a.currency,
             a.current_price::text AS current_price, a.previous_close::text AS previous_close,
             a.market_cap::text AS market_cap, a.last_updated,
             l.compliance_status::text AS compliance_status,
             l.debt_ratio::text AS debt_ratio, l.cash_ratio::text AS cash_ratio,
             l.revenue_screening, l.purification_percent::text AS purification_percent,
             l.screened_at, l.source,
             COUNT(*) OVER() AS total
      FROM assets a
      JOIN latest l ON l.asset_id = a.id
      ${whereSql}
      ORDER BY ${order}
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `;

    const data = rows.map<ScreenerRowDto>((r) => ({
      asset: {
        id: r.id,
        symbol: r.symbol,
        name: r.name,
        type: r.type,
        exchange: r.exchange,
        sector: r.sector,
        currency: r.currency,
        price: D(r.current_price).toFixed(),
        previousClose: r.previous_close ? D(r.previous_close).toFixed() : null,
        marketCapUsd: r.market_cap ? D(r.market_cap).toFixed(0) : null,
        lastUpdated: r.last_updated.toISOString(),
      },
      status: r.compliance_status,
      debtRatio: Number(r.debt_ratio),
      cashRatio: Number(r.cash_ratio),
      haramRevenueRatio: Number(r.revenue_screening.haramRevenueRatio),
      purificationPercent: Number(r.purification_percent),
      screenedAt: r.screened_at.toISOString(),
      isSample: r.source === SAMPLE_DATA_SOURCE,
    }));

    return { data, meta: { page, limit, total: rows.length ? Number(rows[0]!.total) : 0 } };
  }

  /** Values for the filter dropdowns. */
  async filters(): Promise<ScreenerFiltersDto> {
    const [exchanges, sectors] = await Promise.all([
      this.prisma.asset.findMany({
        where: { exchange: { not: null } },
        distinct: ['exchange'],
        select: { exchange: true },
        orderBy: { exchange: 'asc' },
      }),
      this.prisma.asset.findMany({
        where: { sector: { not: null } },
        distinct: ['sector'],
        select: { sector: true },
        orderBy: { sector: 'asc' },
      }),
    ]);
    return {
      exchanges: exchanges.map((e) => e.exchange!),
      sectors: sectors.map((s) => s.sector!),
    };
  }

  /**
   * The verdict for one stock. A result under 24h old is served as is; an older one is
   * re-checked against the data source first. Only a real change creates a new history row.
   */
  async screenStock(symbol: string): Promise<ScreenerDetailDto> {
    const asset = await this.prisma.asset.findUnique({ where: { symbol: symbol.toUpperCase() } });
    if (!asset) throw new NotFoundException('Stock not found');

    let latest = await this.latestFor(asset.id);
    if (!latest) throw new NotFoundException('No screening data for this stock yet');

    let cached = true;
    if (Date.now() - latest.screenedAt.getTime() >= SCREENING_TTL_MS) {
      cached = false;
      latest = await this.refresh(asset, latest);
    }

    const history = await this.prisma.screeningResult.findMany({
      where: { assetId: asset.id },
      orderBy: { screenedAt: 'desc' },
      take: 20,
      select: { complianceStatus: true, screenedAt: true, source: true },
    });

    return {
      asset: toAssetDto(asset),
      screening: toScreeningDto(latest),
      history: history.map((h) => ({
        status: h.complianceStatus,
        screenedAt: h.screenedAt.toISOString(),
        source: h.source,
      })),
      cached,
    };
  }

  private latestFor(assetId: string): Promise<ScreeningResult | null> {
    return this.prisma.screeningResult.findFirst({
      where: { assetId },
      orderBy: { screenedAt: 'desc' },
    });
  }

  private async refresh(asset: Asset, latest: ScreeningResult): Promise<ScreeningResult> {
    // Claim the refresh: only one of several simultaneous requests wins this compare-and-set.
    const claimed = await this.prisma.screeningResult.updateMany({
      where: { id: latest.id, screenedAt: latest.screenedAt },
      data: { screenedAt: new Date() },
    });
    if (claimed.count === 0) return (await this.latestFor(asset.id)) ?? latest;

    const stored = inputFromRow(latest);
    const fresh = await this.financialData.fetch(asset, stored);
    const outcome = screen(fresh);

    if (outcome.status === latest.complianceStatus && sameNumbers(fresh, stored)) {
      return (await this.prisma.screeningResult.findUnique({ where: { id: latest.id } })) ?? latest;
    }

    const created = await this.prisma.screeningResult.create({
      data: {
        assetId: asset.id,
        complianceStatus: outcome.status,
        debtRatio: D(fresh.debtRatio),
        cashRatio: D(fresh.cashRatio),
        receivablesRatio: fresh.receivablesRatio === null ? null : D(fresh.receivablesRatio),
        revenueScreening: {
          haramRevenueRatio: D(fresh.haramRevenueRatio).toFixed(4),
          sources: fresh.sources ?? revenueOf(latest).sources ?? [],
          primaryActivity: fresh.primaryActivity,
          ...(fresh.prohibitedReason ? { prohibitedReason: fresh.prohibitedReason } : {}),
        },
        purificationPercent: outcome.purificationPercent,
        source: latest.source,
      },
    });

    if (outcome.status !== latest.complianceStatus) {
      await this.notifyHolders(asset, latest.complianceStatus, outcome.status);
    }
    return created;
  }

  private async notifyHolders(
    asset: Asset,
    from: ComplianceStatus,
    to: ComplianceStatus,
  ): Promise<void> {
    const holders = await this.prisma.holding.findMany({
      where: { assetId: asset.id },
      select: { userId: true },
    });
    if (holders.length === 0) return;
    this.alerts.publish({
      userIds: holders.map((h) => h.userId),
      alert: {
        type: 'COMPLIANCE_CHANGED',
        symbol: asset.symbol,
        name: asset.name,
        from,
        to,
        at: new Date().toISOString(),
      },
    });
  }
}

function sameNumbers(a: ScreeningInput, b: ScreeningInput): boolean {
  const eq = (
    x: Prisma.Decimal | number | string | null,
    y: Prisma.Decimal | number | string | null,
  ) => (x === null || y === null ? x === y : D(x).eq(D(y)));
  return (
    a.primaryActivity === b.primaryActivity &&
    eq(a.debtRatio, b.debtRatio) &&
    eq(a.cashRatio, b.cashRatio) &&
    eq(a.receivablesRatio, b.receivablesRatio) &&
    eq(a.haramRevenueRatio, b.haramRevenueRatio)
  );
}
