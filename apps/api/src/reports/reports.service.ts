import { Injectable } from '@nestjs/common';
import type { MonthlyTotalDto } from '@barakahfi/shared';
import { PrismaService } from '../prisma/prisma.service';

interface Row {
  month: string;
  type: 'INCOME' | 'EXPENSE';
  total: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Income vs expense per calendar month, oldest first, with empty months filled in
   * as zero so charts have no gaps. Uses the user's default currency (no FX yet).
   */
  async monthlyTotals(userId: string, months: number): Promise<MonthlyTotalDto[]> {
    const { currency } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { currency: true },
    });

    const now = new Date();
    const labels = Array.from({ length: months }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - i), 1));
      return d.toISOString().slice(0, 7);
    });
    const since = `${labels[0]}-01`;

    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT to_char(date_trunc('month', t.date), 'YYYY-MM') AS month,
             t.type::text AS type,
             SUM(t.amount)::text AS total
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      WHERE t.user_id = ${userId}::uuid
        AND a.currency = ${currency}
        AND t.type::text IN ('INCOME', 'EXPENSE')
        AND t.date >= ${since}::date
      GROUP BY 1, 2
    `;

    const byMonth = new Map(labels.map((m) => [m, { income: '0.00', expense: '0.00' }]));
    for (const r of rows) {
      const slot = byMonth.get(r.month);
      if (slot) slot[r.type === 'INCOME' ? 'income' : 'expense'] = Number(r.total).toFixed(2);
    }
    return labels.map((month) => ({ month, ...byMonth.get(month)! }));
  }
}
