import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { HoldingDto, OffsetMeta, PortfolioDto, PortfolioTotalsDto } from '@barakahfi/shared';
import { SAMPLE_DATA_SOURCE } from '@barakahfi/shared';
import { formatDateOnly, parseDateOnly, todayUtc } from '../common/date.util';
import { D } from '../common/decimal.util';
import { Prisma, type Asset, type Holding, type ScreeningResult } from '../generated/prisma/client';
import { FxService } from '../market/fx.service';
import { PrismaService } from '../prisma/prisma.service';
import { purificationAmount } from '../screener/screening.engine';
import type { CreateHoldingDto, PortfolioQuery, UpdateHoldingDto } from './dto/holding.dto';

type HoldingWithAsset = Holding & { asset: Asset };

const ZERO = new Prisma.Decimal(0);
const pct = (n: Prisma.Decimal, of: Prisma.Decimal): number =>
  of.isZero() ? 0 : Number(n.div(of).mul(100).toFixed(1));

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
  ) {}

  /**
   * Holdings table plus portfolio totals. Totals and allocation are computed over ALL holdings
   * in the user's default currency; sorting and paging only affect which rows are returned.
   */
  async list(userId: string, q: PortfolioQuery): Promise<{ data: PortfolioDto; meta: OffsetMeta }> {
    const { totals, rows } = await this.compute(userId);

    const dir = q.dir === 'desc' ? -1 : 1;
    const key = q.sort ?? 'value';
    const sorted = [...rows].sort(
      (a, b) => dir * compare(a, b, key) || a.symbol.localeCompare(b.symbol),
    );

    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    return {
      data: { totals, rows: sorted.slice((page - 1) * limit, page * limit) },
      meta: { page, limit, total: rows.length },
    };
  }

  async create(userId: string, dto: CreateHoldingDto): Promise<HoldingDto> {
    const asset = await this.prisma.asset.findUnique({ where: { symbol: dto.symbol } });
    if (!asset) throw new NotFoundException('Stock not found');
    this.assertNotFuture(dto.purchaseDate);
    if (dto.accountId) await this.assertAccount(userId, dto.accountId);

    try {
      const row = await this.prisma.holding.create({
        data: {
          userId,
          assetId: asset.id,
          accountId: dto.accountId ?? null,
          quantity: D(dto.quantity),
          avgBuyPrice: D(dto.avgBuyPrice),
          purchaseDate: parseDateOnly(dto.purchaseDate),
          dividendsReceived: D(dto.dividendsReceived ?? '0'),
        },
      });
      return this.one(userId, row.id);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          `You already hold ${asset.symbol}. Edit that holding to change the quantity.`,
        );
      }
      throw e;
    }
  }

  async update(userId: string, id: string, dto: UpdateHoldingDto): Promise<HoldingDto> {
    await this.findOwned(userId, id);
    if (dto.purchaseDate) this.assertNotFuture(dto.purchaseDate);
    if (dto.accountId) await this.assertAccount(userId, dto.accountId);

    await this.prisma.holding.update({
      where: { id },
      data: {
        ...(dto.quantity && { quantity: D(dto.quantity) }),
        ...(dto.avgBuyPrice && { avgBuyPrice: D(dto.avgBuyPrice) }),
        ...(dto.purchaseDate && { purchaseDate: parseDateOnly(dto.purchaseDate) }),
        ...(dto.accountId !== undefined && { accountId: dto.accountId }),
        ...(dto.dividendsReceived !== undefined && { dividendsReceived: D(dto.dividendsReceived) }),
      },
    });
    return this.one(userId, id);
  }

  async remove(userId: string, id: string): Promise<null> {
    await this.findOwned(userId, id);
    await this.prisma.holding.delete({ where: { id } });
    return null;
  }

  // ---- internals ----

  private async one(userId: string, id: string): Promise<HoldingDto> {
    const { rows } = await this.compute(userId);
    const row = rows.find((r) => r.id === id);
    if (!row) throw new NotFoundException('Holding not found');
    return row;
  }

  private async findOwned(userId: string, id: string): Promise<Holding> {
    const row = await this.prisma.holding.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Holding not found');
    return row;
  }

  private async assertAccount(userId: string, accountId: string): Promise<void> {
    const ok = await this.prisma.account.findFirst({
      where: { id: accountId, userId, archivedAt: null },
      select: { id: true },
    });
    if (!ok) throw new NotFoundException('Account not found');
  }

  private assertNotFuture(date: string): void {
    if (parseDateOnly(date) > todayUtc())
      throw new BadRequestException('The purchase date cannot be in the future');
  }

  /** Everything the UI needs for every holding, in one place. Money maths uses Decimal throughout. */
  private async compute(
    userId: string,
  ): Promise<{ totals: PortfolioTotalsDto; rows: HoldingDto[] }> {
    const [user, holdings] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { currency: true } }),
      this.prisma.holding.findMany({ where: { userId }, include: { asset: true } }),
    ]);
    const base = user.currency;

    const latest = await this.latestScreenings(holdings.map((h) => h.assetId));
    const currencies = [...new Set(holdings.map((h) => h.asset.currency))];
    const rates = new Map(
      await Promise.all(currencies.map(async (c) => [c, await this.fx.rate(c, base)] as const)),
    );

    const built = holdings.map((h) =>
      this.build(h, latest.get(h.assetId), rates.get(h.asset.currency)!),
    );

    const sum = (f: (b: ReturnType<PortfolioService['build']>) => Prisma.Decimal) =>
      built.reduce((s, b) => s.plus(f(b)), ZERO);
    const valueBase = sum((b) => b.valueBase);
    const costBase = sum((b) => b.costBase);
    const gainBase = valueBase.minus(costBase);
    const dayBase = sum((b) => b.dayChangeBase);
    const previousBase = valueBase.minus(dayBase);

    const rows = built.map((b) => ({ ...b.dto, allocationPercent: pct(b.valueBase, valueBase) }));

    return {
      rows,
      totals: {
        currency: base,
        value: valueBase.toFixed(2),
        cost: costBase.toFixed(2),
        gainLoss: gainBase.toFixed(2),
        gainLossPercent: pct(gainBase, costBase),
        dayChange: dayBase.toFixed(2),
        dayChangePercent: pct(dayBase, previousBase),
        purificationDue: sum((b) => b.purificationDueBase).toFixed(2),
      },
    };
  }

  private build(h: HoldingWithAsset, screening: ScreeningResult | undefined, rate: Prisma.Decimal) {
    const price = h.asset.currentPrice;
    const value = h.quantity.mul(price);
    const cost = h.quantity.mul(h.avgBuyPrice);
    const gain = value.minus(cost);
    const dayChange = h.asset.previousClose
      ? h.quantity.mul(price.minus(h.asset.previousClose))
      : ZERO;
    const purificationPercent = screening?.purificationPercent ?? ZERO;
    const purificationDue = purificationAmount(h.dividendsReceived, purificationPercent);

    const dto: HoldingDto = {
      id: h.id,
      assetId: h.assetId,
      symbol: h.asset.symbol,
      name: h.asset.name,
      exchange: h.asset.exchange,
      currency: h.asset.currency,
      quantity: h.quantity.toFixed(),
      avgBuyPrice: h.avgBuyPrice.toFixed(),
      purchaseDate: formatDateOnly(h.purchaseDate),
      accountId: h.accountId,
      dividendsReceived: h.dividendsReceived.toFixed(2),
      currentPrice: price.toFixed(),
      previousClose: h.asset.previousClose?.toFixed() ?? null,
      priceUpdatedAt: h.asset.lastUpdated.toISOString(),
      value: value.toFixed(2),
      cost: cost.toFixed(2),
      gainLoss: gain.toFixed(2),
      gainLossPercent: pct(gain, cost),
      dayChange: dayChange.toFixed(2),
      valueBase: value.mul(rate).toFixed(2),
      allocationPercent: 0,
      status: screening?.complianceStatus ?? null,
      purificationPercent: purificationPercent.toNumber(),
      purificationDue: purificationDue.toFixed(2),
      isSample: screening?.source === SAMPLE_DATA_SOURCE,
    };
    return {
      dto,
      valueBase: value.mul(rate),
      costBase: cost.mul(rate),
      dayChangeBase: dayChange.mul(rate),
      purificationDueBase: purificationDue.mul(rate),
    };
  }

  private async latestScreenings(assetIds: string[]): Promise<Map<string, ScreeningResult>> {
    if (assetIds.length === 0) return new Map();
    const rows = await this.prisma.screeningResult.findMany({
      where: { assetId: { in: assetIds } },
      distinct: ['assetId'],
      orderBy: [{ assetId: 'asc' }, { screenedAt: 'desc' }],
    });
    return new Map(rows.map((r) => [r.assetId, r]));
  }
}

/** Gain or loss expressed in the user's default currency (native gain x the value's FX ratio). */
function gainInBase(h: HoldingDto): Prisma.Decimal {
  const value = D(h.value);
  return value.isZero() ? D(0) : D(h.gainLoss).mul(D(h.valueBase)).div(value);
}

function compare(a: HoldingDto, b: HoldingDto, key: NonNullable<PortfolioQuery['sort']>): number {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name);
    case 'status':
      return (a.status ?? '').localeCompare(b.status ?? '');
    case 'allocation':
      return a.allocationPercent - b.allocationPercent;
    case 'gainLossPercent':
      return a.gainLossPercent - b.gainLossPercent;
    case 'value':
      return D(a.valueBase).comparedTo(b.valueBase);
    case 'gainLoss':
      // Native amounts in different currencies can't be ranked; compare them in the default currency.
      return gainInBase(a).comparedTo(gainInBase(b));
    default:
      return D(a[key]).comparedTo(b[key]);
  }
}
