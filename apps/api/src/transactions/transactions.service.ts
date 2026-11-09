import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TransactionDto, TransactionSummaryDto } from '@barakahfi/shared';
import { formatDateOnly, parseDateOnly } from '../common/date.util';
import { Prisma, type Transaction } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { balanceEffects } from './balance-effects';
import type {
  CreateTransactionDto,
  ListTransactionsQuery,
  SummaryQuery,
  UpdateTransactionDto,
} from './dto/transaction.dto';

const include = {
  account: { select: { name: true, currency: true } },
  transferAccount: { select: { name: true } },
  category: { select: { name: true, icon: true, halalStatus: true } },
} satisfies Prisma.TransactionInclude;

type TransactionRow = Prisma.TransactionGetPayload<{ include: typeof include }>;
type Db = Prisma.TransactionClient;

export function toTransactionDto(t: TransactionRow): TransactionDto {
  return {
    id: t.id,
    type: t.type,
    amount: t.amount.toFixed(2),
    description: t.description,
    date: formatDateOnly(t.date),
    accountId: t.accountId,
    accountName: t.account.name,
    currency: t.account.currency,
    transferAccountId: t.transferAccountId,
    transferAccountName: t.transferAccount?.name ?? null,
    categoryId: t.categoryId,
    categoryName: t.category?.name ?? null,
    categoryIcon: t.category?.icon ?? null,
    categoryHalalStatus: t.category?.halalStatus ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

/** The fields that define a ledger entry, after merging an update onto the stored row. */
interface Entry {
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  accountId: string;
  transferAccountId: string | null;
  categoryId: string | null;
  amount: string;
  description: string;
  date: string;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTransactionDto): Promise<TransactionDto> {
    const entry = this.normalise({
      type: dto.type,
      accountId: dto.accountId,
      transferAccountId: dto.transferAccountId ?? null,
      categoryId: dto.categoryId ?? null,
      amount: dto.amount,
      description: dto.description ?? '',
      date: dto.date,
    });

    return this.prisma.$transaction(async (tx) => {
      await this.assertValid(tx, userId, entry);
      const row = await tx.transaction.create({
        data: this.toData(userId, entry),
        include,
      });
      await this.applyEffects(tx, row, 1);
      return toTransactionDto(row);
    });
  }

  /**
   * Edit = undo the old entry's effect on balances, then apply the new one,
   * all inside one DB transaction. The row lock stops two simultaneous edits
   * from both reversing the same old amount.
   */
  async update(userId: string, id: string, dto: UpdateTransactionDto): Promise<TransactionDto> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await this.lockAndLoad(tx, userId, id);

      const entry = this.normalise({
        type: dto.type ?? existing.type,
        accountId: dto.accountId ?? existing.accountId,
        transferAccountId:
          dto.transferAccountId !== undefined ? dto.transferAccountId : existing.transferAccountId,
        categoryId: dto.categoryId !== undefined ? dto.categoryId : existing.categoryId,
        amount: dto.amount ?? existing.amount.toFixed(2),
        description: dto.description ?? existing.description,
        date: dto.date ?? formatDateOnly(existing.date),
      });

      // Accounts the entry already uses may be archived since; only re-check changed ones.
      const unchanged = new Set(
        [existing.accountId, existing.transferAccountId].filter((v): v is string => !!v),
      );
      await this.assertValid(tx, userId, entry, unchanged);

      await this.applyEffects(tx, existing, -1);
      const row = await tx.transaction.update({ where: { id }, data: this.toData(userId, entry) });
      await this.applyEffects(tx, row, 1);
    });
    return this.load(userId, id);
  }

  async remove(userId: string, id: string): Promise<null> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await this.lockAndLoad(tx, userId, id);
      await this.applyEffects(tx, existing, -1);
      await tx.transaction.delete({ where: { id } });
    });
    return null;
  }

  /** Cursor pagination: stable for infinite scroll even while new rows are inserted. */
  async list(userId: string, q: ListTransactionsQuery) {
    const limit = q.limit ?? 20;
    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(q.type && { type: q.type }),
      ...(q.categoryId && { categoryId: q.categoryId }),
      ...(q.accountId && { OR: [{ accountId: q.accountId }, { transferAccountId: q.accountId }] }),
      ...this.dateRange(q.from, q.to),
    };

    const rows = await this.prisma.transaction.findMany({
      where,
      include,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
    });

    const page = rows.slice(0, limit);
    return {
      data: page.map(toTransactionDto),
      meta: { nextCursor: rows.length > limit ? page[page.length - 1]!.id : null, limit },
    };
  }

  /** Income, expense and net per currency. Transfers are excluded: they only move money around. */
  async summary(userId: string, q: SummaryQuery): Promise<TransactionSummaryDto[]> {
    const [groups, accounts] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['accountId', 'type'],
        where: { userId, type: { in: ['INCOME', 'EXPENSE'] }, ...this.dateRange(q.from, q.to) },
        _sum: { amount: true },
      }),
      this.prisma.account.findMany({ where: { userId }, select: { id: true, currency: true } }),
    ]);

    const currencyOf = new Map(accounts.map((a) => [a.id, a.currency]));
    const totals = new Map<string, { income: Prisma.Decimal; expense: Prisma.Decimal }>();
    for (const g of groups) {
      const currency = currencyOf.get(g.accountId);
      if (!currency) continue;
      const t = totals.get(currency) ?? {
        income: new Prisma.Decimal(0),
        expense: new Prisma.Decimal(0),
      };
      const sum = g._sum.amount ?? new Prisma.Decimal(0);
      if (g.type === 'INCOME') t.income = t.income.plus(sum);
      else t.expense = t.expense.plus(sum);
      totals.set(currency, t);
    }

    return [...totals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, t]) => ({
        currency,
        income: t.income.toFixed(2),
        expense: t.expense.toFixed(2),
        net: t.income.minus(t.expense).toFixed(2),
      }));
  }

  // ---- internals ----

  /** Read the finished record (with account/category names) after its DB transaction has committed. */
  private async load(userId: string, id: string): Promise<TransactionDto> {
    const row = await this.prisma.transaction.findFirstOrThrow({ where: { id, userId }, include });
    return toTransactionDto(row);
  }

  /** Cross-field rules the DTO can't express. Also clears fields that don't apply to the type. */
  private normalise(e: Entry): Entry {
    if (e.type === 'TRANSFER') {
      if (!e.transferAccountId)
        throw new BadRequestException('A transfer needs a destination account');
      if (e.transferAccountId === e.accountId) {
        throw new BadRequestException('A transfer needs two different accounts');
      }
      return { ...e, categoryId: null };
    }
    if (e.transferAccountId && e.transferAccountId !== null) {
      // Switching a transfer to income/expense via update drops the destination; sending one explicitly is an error.
      return { ...e, transferAccountId: null };
    }
    return e;
  }

  private async assertValid(
    db: Db,
    userId: string,
    e: Entry,
    skipAccounts: Set<string> = new Set(),
  ) {
    const ids = [e.accountId, e.transferAccountId].filter((v): v is string => !!v);
    const toCheck = ids.filter((id) => !skipAccounts.has(id));
    if (toCheck.length > 0) {
      const found = await db.account.findMany({
        where: { id: { in: toCheck }, userId, archivedAt: null },
        select: { id: true },
      });
      if (found.length !== new Set(toCheck).size) throw new NotFoundException('Account not found');
    }

    if (e.type === 'TRANSFER') {
      const accounts = await db.account.findMany({
        where: { id: { in: ids }, userId },
        select: { currency: true },
      });
      if (new Set(accounts.map((a) => a.currency)).size > 1) {
        throw new BadRequestException(
          'Transfers between different currencies are not supported yet',
        );
      }
    }

    if (e.categoryId) {
      const category = await db.category.findFirst({
        where: { id: e.categoryId, OR: [{ userId: null }, { userId }] },
        select: { type: true },
      });
      if (!category) throw new NotFoundException('Category not found');
      if (category.type !== e.type) {
        throw new BadRequestException(
          `A ${category.type.toLowerCase()} category can't be used for ${e.type.toLowerCase()}`,
        );
      }
    }
  }

  private toData(userId: string, e: Entry) {
    return {
      userId,
      type: e.type,
      accountId: e.accountId,
      transferAccountId: e.transferAccountId,
      categoryId: e.categoryId,
      amount: new Prisma.Decimal(e.amount),
      description: e.description,
      date: parseDateOnly(e.date),
    };
  }

  /**
   * Lock the row (an UPDATE takes a row lock until the DB transaction ends), then read it.
   * Concurrent edits of the same transaction queue up here, and each sees the previous
   * one's committed result, so a balance is never reversed twice.
   */
  private async lockAndLoad(tx: Db, userId: string, id: string) {
    const locked = await tx.transaction.updateMany({
      where: { id, userId },
      data: { updatedAt: new Date() },
    });
    if (locked.count === 0) throw new NotFoundException('Transaction not found');
    return tx.transaction.findFirstOrThrow({
      where: { id, userId },
      include,
    });
  }

  /** sign +1 applies the entry to balances, -1 reverses it. Increments are atomic in SQL. */
  private async applyEffects(
    tx: Db,
    row: Pick<Transaction, 'type' | 'accountId' | 'transferAccountId' | 'amount'>,
    sign: 1 | -1,
  ) {
    for (const { accountId, delta } of balanceEffects(row)) {
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { increment: sign === 1 ? delta : delta.neg() } },
      });
    }
  }

  private dateRange(from?: string, to?: string): Prisma.TransactionWhereInput {
    if (!from && !to) return {};
    return {
      date: {
        ...(from && { gte: parseDateOnly(from) }),
        ...(to && { lte: parseDateOnly(to) }),
      },
    };
  }
}
