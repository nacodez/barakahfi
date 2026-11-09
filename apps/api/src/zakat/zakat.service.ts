import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NISAB_GOLD_GRAMS,
  NISAB_SILVER_GRAMS,
  ZAKAT_RATE,
  type NisabMethodName,
  type ZakatCalculationDto,
  type ZakatContextDto,
  type ZakatItemDto,
  type ZakatRecordDto,
  type ZakatSummaryDto,
} from '@barakahfi/shared';
import { formatDateOnly, todayUtc } from '../common/date.util';
import { D } from '../common/decimal.util';
import { Prisma, type ZakatRecord } from '../generated/prisma/client';
import { FxService } from '../market/fx.service';
import { MetalsService } from '../market/metals.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CalculateZakatDto, SaveZakatDto, UpdateZakatRecordDto } from './dto/zakat.dto';
import { computeZakat } from './zakat.calc';
import { hawl, hijriYear } from './hijri.util';

const money = (v: Prisma.Decimal) => v.toFixed(2);

@Injectable()
export class ZakatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
    private readonly metals: MetalsService,
  ) {}

  /** Everything the wizard needs to pre-populate its first steps. */
  async context(userId: string): Promise<ZakatContextDto> {
    const user = await this.user(userId);
    const [prices, accounts, holdings] = await Promise.all([
      this.prices(user.currency),
      this.prisma.account.findMany({
        where: { userId, archivedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.holding.findMany({
        where: { userId },
        include: { asset: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const statuses = await this.latestStatuses(holdings.map((h) => h.assetId));

    return {
      currency: user.currency,
      nisabMethod: user.nisabMethod,
      hijriYear: hijriYear(new Date()),
      ...this.priceFields(prices),
      accounts: await Promise.all(
        accounts.map(async (a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          currency: a.currency,
          balance: money(a.balance),
          balanceBase: money(await this.fx.convert(a.balance, a.currency, user.currency)),
          isZakatable: a.isZakatable,
        })),
      ),
      holdings: await Promise.all(
        holdings.map(async (h) => {
          const value = h.quantity.mul(h.asset.currentPrice);
          return {
            id: h.id,
            symbol: h.asset.symbol,
            name: h.asset.name,
            currency: h.asset.currency,
            value: money(value),
            valueBase: money(await this.fx.convert(value, h.asset.currency, user.currency)),
            status: statuses.get(h.assetId) ?? null,
          };
        }),
      ),
    };
  }

  /**
   * Work out zakat for the selection. Account and holding amounts are always re-read from the
   * database (the client only sends ids), so the figure can't be tampered with from the browser.
   */
  async calculate(userId: string, input: CalculateZakatDto): Promise<ZakatCalculationDto> {
    const user = await this.user(userId);
    const prices = await this.prices(user.currency);
    const method: NisabMethodName = input.nisabMethod ?? user.nisabMethod;

    const items: ZakatItemDto[] = [];
    const accountIds = [...new Set(input.accountIds)];
    const holdingIds = [...new Set(input.holdingIds)];

    if (accountIds.length > 0) {
      const accounts = await this.prisma.account.findMany({
        where: { id: { in: accountIds }, userId, archivedAt: null },
      });
      if (accounts.length !== accountIds.length) throw new NotFoundException('Account not found');
      for (const a of accounts) {
        items.push({
          kind: 'ACCOUNT',
          label: a.name,
          amount: money(await this.fx.convert(a.balance, a.currency, user.currency)),
        });
      }
    }

    if (holdingIds.length > 0) {
      const holdings = await this.prisma.holding.findMany({
        where: { id: { in: holdingIds }, userId },
        include: { asset: true },
      });
      if (holdings.length !== holdingIds.length) throw new NotFoundException('Holding not found');
      for (const h of holdings) {
        const value = h.quantity.mul(h.asset.currentPrice);
        items.push({
          kind: 'HOLDING',
          label: `${h.asset.symbol} shares`,
          amount: money(await this.fx.convert(value, h.asset.currency, user.currency)),
        });
      }
    }

    const manual = (kind: ZakatItemDto['kind'], label: string, amount: Prisma.Decimal) => {
      if (amount.gt(0)) items.push({ kind, label, amount: money(amount) });
    };
    manual('CASH', 'Cash on hand', D(input.cashOnHand));
    manual('RECEIVABLES', 'Money owed to you', D(input.receivables));
    manual(
      'GOLD',
      `Gold (${input.goldJewelryGrams} g)`,
      D(input.goldJewelryGrams).mul(prices.gold.perGram),
    );
    manual(
      'SILVER',
      `Silver (${input.silverGrams} g)`,
      D(input.silverGrams).mul(prices.silver.perGram),
    );
    manual('OTHER', 'Other zakatable assets', D(input.otherAssets));

    const nisabGold = prices.gold.perGram.mul(NISAB_GOLD_GRAMS);
    const nisabSilver = prices.silver.perGram.mul(NISAB_SILVER_GRAMS);
    const nisabUsed = method === 'GOLD' ? nisabGold : nisabSilver;

    const math = computeZakat({
      assets: items.map((i) => i.amount),
      liabilities: input.liabilities,
      nisab: nisabUsed,
      rate: ZAKAT_RATE,
    });

    return {
      currency: user.currency,
      nisabMethod: method,
      items,
      assetsTotal: money(math.assetsTotal),
      liabilities: money(D(input.liabilities)),
      netWealth: money(math.netWealth),
      nisabUsed: money(nisabUsed),
      meetsNisab: math.meetsNisab,
      zakatDue: money(math.zakatDue),
      rate: ZAKAT_RATE,
      ...this.priceFields(prices),
    };
  }

  /** Recalculates on the server and stores the result against the current Hijri year. */
  async save(userId: string, input: SaveZakatDto): Promise<ZakatRecordDto> {
    const calc = await this.calculate(userId, input);
    const row = await this.prisma.zakatRecord.create({
      data: {
        userId,
        hijriYear: hijriYear(new Date()),
        currency: calc.currency,
        nisabMethod: calc.nisabMethod,
        totalAssets: D(calc.netWealth),
        nisabValue: D(calc.nisabUsed),
        zakatDue: D(calc.zakatDue),
        breakdown: calc as unknown as Prisma.InputJsonValue,
        notes: input.notes ?? null,
      },
    });
    return toRecordDto(row);
  }

  async list(userId: string): Promise<ZakatRecordDto[]> {
    const rows = await this.prisma.zakatRecord.findMany({
      where: { userId },
      orderBy: { calculatedAt: 'desc' },
    });
    return rows.map(toRecordDto);
  }

  /** Mark how much has been paid (and add notes). Safe to call repeatedly. */
  async update(userId: string, id: string, dto: UpdateZakatRecordDto): Promise<ZakatRecordDto> {
    const existing = await this.prisma.zakatRecord.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Record not found');
    const row = await this.prisma.zakatRecord.update({
      where: { id },
      data: {
        ...(dto.zakatPaid !== undefined && { zakatPaid: D(dto.zakatPaid) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
    return toRecordDto(row);
  }

  /** Dashboard card: where the hawl stands and a rough estimate (zakatable accounts + all holdings). */
  async summary(userId: string): Promise<ZakatSummaryDto> {
    const user = await this.user(userId);
    const [accounts, holdings, latest] = await Promise.all([
      this.prisma.account.findMany({
        where: { userId, archivedAt: null, isZakatable: true },
        select: { id: true },
      }),
      this.prisma.holding.findMany({ where: { userId }, select: { id: true } }),
      this.prisma.zakatRecord.findFirst({ where: { userId }, orderBy: { calculatedAt: 'desc' } }),
    ]);
    const calc = await this.calculate(userId, {
      accountIds: accounts.map((a) => a.id),
      holdingIds: holdings.map((h) => h.id),
      cashOnHand: '0',
      receivables: '0',
      goldJewelryGrams: '0',
      silverGrams: '0',
      otherAssets: '0',
      liabilities: '0',
    });
    const h = hawl(user.zakatStartDate, todayUtc());

    return {
      currency: calc.currency,
      nisabMethod: calc.nisabMethod,
      hawlStartDate: user.zakatStartDate ? formatDateOnly(user.zakatStartDate) : null,
      hawlEndDate: h ? formatDateOnly(h.end) : null,
      daysRemaining: h?.daysRemaining ?? null,
      estimatedZakat: calc.zakatDue,
      netWealth: calc.netWealth,
      nisabUsed: calc.nisabUsed,
      meetsNisab: calc.meetsNisab,
      hijriYear: hijriYear(new Date()),
      latestRecord: latest
        ? {
            hijriYear: latest.hijriYear,
            zakatDue: money(latest.zakatDue),
            zakatPaid: money(latest.zakatPaid),
          }
        : null,
    };
  }

  // ---- internals ----

  private user(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { currency: true, nisabMethod: true, zakatStartDate: true },
    });
  }

  private async prices(currency: string) {
    const [gold, silver] = await Promise.all([
      this.metals.perGram('gold', currency),
      this.metals.perGram('silver', currency),
    ]);
    return { gold, silver };
  }

  private priceFields(p: {
    gold: { perGram: Prisma.Decimal; asOf: Date; source: 'live' | 'cached' };
    silver: { perGram: Prisma.Decimal; asOf: Date; source: 'live' | 'cached' };
  }) {
    const asOf = p.gold.asOf < p.silver.asOf ? p.gold.asOf : p.silver.asOf;
    return {
      goldPricePerGram: p.gold.perGram.toFixed(2),
      silverPricePerGram: p.silver.perGram.toFixed(2),
      nisabGold: money(p.gold.perGram.mul(NISAB_GOLD_GRAMS)),
      nisabSilver: money(p.silver.perGram.mul(NISAB_SILVER_GRAMS)),
      pricesAsOf: asOf.toISOString(),
      pricesSource:
        p.gold.source === 'cached' || p.silver.source === 'cached'
          ? ('cached' as const)
          : ('live' as const),
    };
  }

  private async latestStatuses(assetIds: string[]) {
    if (assetIds.length === 0)
      return new Map<string, ZakatContextDto['holdings'][number]['status']>();
    const rows = await this.prisma.screeningResult.findMany({
      where: { assetId: { in: assetIds } },
      distinct: ['assetId'],
      orderBy: [{ assetId: 'asc' }, { screenedAt: 'desc' }],
      select: { assetId: true, complianceStatus: true },
    });
    return new Map(rows.map((r) => [r.assetId, r.complianceStatus]));
  }
}

function toRecordDto(r: ZakatRecord): ZakatRecordDto {
  return {
    id: r.id,
    hijriYear: r.hijriYear,
    currency: r.currency,
    nisabMethod: r.nisabMethod,
    totalAssets: money(r.totalAssets),
    nisabValue: money(r.nisabValue),
    zakatDue: money(r.zakatDue),
    zakatPaid: money(r.zakatPaid),
    breakdown: r.breakdown as unknown as ZakatCalculationDto,
    notes: r.notes,
    calculatedAt: r.calculatedAt.toISOString(),
  };
}
