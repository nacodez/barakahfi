import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { budgetStatus, type BudgetDto } from '@barakahfi/shared';
import { formatDateOnly, parseDateOnly, todayUtc } from '../common/date.util';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { budgetWindow, hasStarted } from './budget-window.util';
import type { CreateBudgetDto, UpdateBudgetDto } from './dto/budget.dto';

const include = { category: { select: { name: true, icon: true } } } satisfies Prisma.BudgetInclude;
type BudgetRow = Prisma.BudgetGetPayload<{ include: typeof include }>;

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Budgets are in the user's default currency, so only spending from accounts in that
   * currency counts against them (no FX conversion yet).
   */
  async list(userId: string, on?: string): Promise<BudgetDto[]> {
    const [user, rows] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { currency: true } }),
      this.prisma.budget.findMany({
        where: { userId },
        include,
        orderBy: { category: { name: 'asc' } },
      }),
    ]);
    const reference = on ? parseDateOnly(on) : todayUtc();
    return Promise.all(rows.map((b) => this.evaluate(userId, user.currency, b, reference)));
  }

  async create(userId: string, dto: CreateBudgetDto): Promise<BudgetDto> {
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, OR: [{ userId: null }, { userId }] },
      select: { type: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    if (category.type !== 'EXPENSE')
      throw new BadRequestException('Budgets can only be set on expense categories');

    try {
      const row = await this.prisma.budget.create({
        data: {
          userId,
          categoryId: dto.categoryId,
          amount: new Prisma.Decimal(dto.amount),
          period: dto.period,
          startDate: parseDateOnly(dto.startDate),
        },
        include,
      });
      return this.evaluateOne(userId, row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('You already have a budget for this category and period');
      }
      throw e;
    }
  }

  async update(userId: string, id: string, dto: UpdateBudgetDto): Promise<BudgetDto> {
    await this.findOwned(userId, id);
    const row = await this.prisma.budget.update({
      where: { id },
      data: {
        ...(dto.amount && { amount: new Prisma.Decimal(dto.amount) }),
        ...(dto.startDate && { startDate: parseDateOnly(dto.startDate) }),
      },
      include,
    });
    return this.evaluateOne(userId, row);
  }

  async remove(userId: string, id: string): Promise<null> {
    await this.findOwned(userId, id);
    await this.prisma.budget.delete({ where: { id } });
    return null;
  }

  private async findOwned(userId: string, id: string) {
    const row = await this.prisma.budget.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Budget not found');
    return row;
  }

  private async evaluateOne(userId: string, row: BudgetRow): Promise<BudgetDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { currency: true },
    });
    return this.evaluate(userId, user.currency, row, todayUtc());
  }

  private async evaluate(
    userId: string,
    currency: string,
    b: BudgetRow,
    reference: Date,
  ): Promise<BudgetDto> {
    const window = budgetWindow(b.period, b.startDate, reference);

    let spent = new Prisma.Decimal(0);
    if (hasStarted(b.startDate, window)) {
      const agg = await this.prisma.transaction.aggregate({
        where: {
          userId,
          categoryId: b.categoryId,
          type: 'EXPENSE',
          date: { gte: window.start, lt: window.end },
          account: { currency },
        },
        _sum: { amount: true },
      });
      spent = agg._sum.amount ?? spent;
    }

    const percent = Number(spent.div(b.amount).mul(100).toFixed(1));
    return {
      id: b.id,
      categoryId: b.categoryId,
      categoryName: b.category.name,
      categoryIcon: b.category.icon,
      period: b.period,
      amount: b.amount.toFixed(2),
      spent: spent.toFixed(2),
      remaining: b.amount.minus(spent).toFixed(2),
      percent,
      status: budgetStatus(percent),
      startDate: formatDateOnly(b.startDate),
      windowStart: formatDateOnly(window.start),
      windowEnd: formatDateOnly(window.end),
    };
  }
}
