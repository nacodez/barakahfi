'use client';

import type { BudgetDto } from '@barakahfi/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCents } from '@/lib/money';

const money = (value: unknown, currency: string) =>
  formatCents(BigInt(Math.round(Number(value) * 100)), currency);

export default function BudgetChartImpl({
  budgets,
  currency,
}: {
  budgets: BudgetDto[];
  currency: string;
}) {
  const rows = budgets.map((b) => ({
    name: b.categoryName,
    Budgeted: Number(b.amount),
    Spent: Number(b.spent),
  }));
  const summary = budgets
    .map((b) => `${b.categoryName}: budgeted ${b.amount}, spent ${b.spent}`)
    .join('; ');

  return (
    <div
      role="img"
      aria-label={`Budgeted versus spent per category in ${currency}. ${summary}`}
      className="h-64 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            strokeOpacity={0.12}
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            stroke="currentColor"
            strokeOpacity={0.6}
            fontSize={12}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            stroke="currentColor"
            strokeOpacity={0.6}
            fontSize={12}
            width={48}
          />
          <Tooltip
            formatter={(value) => money(value, currency)}
            contentStyle={{ borderRadius: 8, fontSize: 13 }}
            cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
          <Bar dataKey="Budgeted" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Spent" fill="#059669" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
