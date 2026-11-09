'use client';

import type { MonthlyTotalDto } from '@barakahfi/shared';
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
import { monthLabel } from '@/lib/date';
import { formatCents } from '@/lib/money';

const money = (value: unknown, currency: string) =>
  formatCents(BigInt(Math.round(Number(value) * 100)), currency);

export default function IncomeExpenseChartImpl({
  data,
  currency,
}: {
  data: MonthlyTotalDto[];
  currency: string;
}) {
  const rows = data.map((m) => ({
    month: monthLabel(m.month),
    Income: Number(m.income),
    Expenses: Number(m.expense),
  }));
  const summary = data
    .map((m) => `${monthLabel(m.month)}: income ${m.income}, expenses ${m.expense}`)
    .join('; ');

  return (
    <div
      role="img"
      aria-label={`Income versus expenses by month in ${currency}. ${summary}`}
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
            dataKey="month"
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
          <Bar dataKey="Income" fill="#059669" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Expenses" fill="#e11d48" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
