'use client';

import Link from 'next/link';
import { AddAccountForm } from '@/components/add-account-form';
import { BudgetBar, STATUS_TEXT } from '@/components/budgets/budget-bar';
import { IncomeExpenseChart } from '@/components/charts/income-expense-chart';
import { HalalBadge } from '@/components/halal-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAccounts, useArchiveAccount } from '@/hooks/use-accounts';
import { useMe } from '@/hooks/use-auth';
import { useBudgets, useMonthlyTotals } from '@/hooks/use-budgets';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useTransactions } from '@/hooks/use-transactions';
import { ZakatCard } from '@/components/zakat/zakat-card';
import { cn } from '@/lib/cn';
import { formatCents, toCents, totalsByCurrency } from '@/lib/money';

const MORE = 'text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400';

function RecentTransactions() {
  const query = useTransactions({}, 10);
  const rows = query.data?.pages[0]?.data ?? [];

  return (
    <Card
      title="Recent transactions"
      action={
        <Link href="/transactions" className={MORE}>
          View all
        </Link>
      }
    >
      {query.isPending ? (
        <p className="text-zinc-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-zinc-500">
          Nothing yet.{' '}
          <Link href="/transactions" className={MORE}>
            Add a transaction
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <span className="w-7 text-center text-lg" aria-hidden>
                {t.type === 'TRANSFER' ? '⇄' : (t.categoryIcon ?? '•')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-medium">
                  {t.type === 'TRANSFER'
                    ? `Transfer to ${t.transferAccountName ?? 'account'}`
                    : t.description || t.categoryName || 'Transaction'}
                  <HalalBadge status={t.categoryHalalStatus} />
                </p>
                <p className="text-xs text-zinc-500">
                  {t.date} · {t.accountName}
                </p>
              </div>
              <span
                className={cn(
                  'text-sm font-medium tabular-nums',
                  t.type === 'INCOME' && 'text-emerald-700 dark:text-emerald-400',
                  t.type === 'EXPENSE' && 'text-red-600 dark:text-red-400',
                )}
              >
                {t.type === 'INCOME' ? '+' : t.type === 'EXPENSE' ? '−' : ''}
                {formatCents(toCents(t.amount), t.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PortfolioSummary() {
  const portfolio = usePortfolio({ sort: 'value', dir: 'desc', page: 1 });
  const t = portfolio.data?.data.totals;
  const count = portfolio.data?.meta.total ?? 0;
  const tone = (v: string) =>
    Number(v) > 0
      ? 'text-emerald-700 dark:text-emerald-400'
      : Number(v) < 0
        ? 'text-red-600 dark:text-red-400'
        : '';

  return (
    <Card
      title="Portfolio"
      action={
        <Link href="/portfolio" className={MORE}>
          View
        </Link>
      }
    >
      {portfolio.isPending ? (
        <p className="text-zinc-500">Loading…</p>
      ) : !t || count === 0 ? (
        <p className="text-zinc-500">
          No holdings yet.{' '}
          <Link href="/screener" className={MORE}>
            Find a halal stock
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-2xl font-semibold tabular-nums">
            {formatCents(toCents(t.value), t.currency)}
          </p>
          <p className={cn('text-sm tabular-nums', tone(t.gainLoss))}>
            {Number(t.gainLoss) > 0 ? '+' : ''}
            {formatCents(toCents(t.gainLoss), t.currency)} ({t.gainLossPercent > 0 ? '+' : ''}
            {t.gainLossPercent.toFixed(1)}%) overall
          </p>
          {Number(t.purificationDue) > 0 && (
            <p className="text-sm text-zinc-500">
              Purification due: {formatCents(toCents(t.purificationDue), t.currency)}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function BudgetHealth() {
  const budgets = useBudgets();
  const list = [...(budgets.data ?? [])].sort((a, b) => b.percent - a.percent);
  const count = (s: string) => list.filter((b) => b.status === s).length;

  return (
    <Card
      title="Budget health"
      action={
        <Link href="/budgets" className={MORE}>
          Manage
        </Link>
      }
    >
      {budgets.isPending ? (
        <p className="text-zinc-500">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-zinc-500">
          No budgets yet.{' '}
          <Link href="/budgets" className={MORE}>
            Set one
          </Link>
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            {count('ON_TRACK')} on track · {count('WARNING')} getting close · {count('OVER')} over
          </p>
          <ul className="flex flex-col gap-4">
            {list.slice(0, 4).map((b) => (
              <li key={b.id}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="font-medium">
                    <span aria-hidden className="mr-1.5">
                      {b.categoryIcon}
                    </span>
                    {b.categoryName}
                  </span>
                  <span className="text-zinc-500">
                    {b.percent}% · {STATUS_TEXT[b.status]}
                  </span>
                </div>
                <BudgetBar
                  percent={b.percent}
                  status={b.status}
                  label={`${b.categoryName} budget`}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export function DashboardView() {
  const { data: user } = useMe();
  const accounts = useAccounts();
  const archive = useArchiveAccount();
  const monthly = useMonthlyTotals(6);

  const list = accounts.data ?? [];
  const totals = totalsByCurrency(list);
  const currency = user?.currency ?? 'AED';
  const hasFlow = monthly.data?.some((m) => Number(m.income) > 0 || Number(m.expense) > 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Assalamu alaikum{user ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">Here is where your wealth stands today.</p>
      </div>

      <Card title="Net worth">
        {accounts.isPending ? (
          <p className="text-zinc-500">Loading…</p>
        ) : totals.length === 0 ? (
          <p className="text-zinc-500">Add an account below to see your net worth.</p>
        ) : (
          <ul className="flex flex-wrap gap-x-10 gap-y-2">
            {totals.map((t) => (
              <li key={t.currency} className="text-3xl font-semibold tabular-nums">
                {formatCents(t.cents, t.currency)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Income vs expenses, last 6 months (${currency})`}>
        {monthly.isPending ? (
          <div className="h-64 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" aria-hidden />
        ) : monthly.isError ? (
          <p className="text-red-600">Could not load the chart.</p>
        ) : !hasFlow ? (
          <p className="text-zinc-500">
            Record some income and expenses to see your monthly trend.
          </p>
        ) : (
          <IncomeExpenseChart data={monthly.data ?? []} currency={currency} />
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentTransactions />
        <BudgetHealth />
        <ZakatCard />
        <PortfolioSummary />
      </div>

      <Card title="Accounts">
        {accounts.isError ? (
          <p className="text-red-600">Could not load accounts.</p>
        ) : list.length === 0 && !accounts.isPending ? (
          <p className="text-zinc-500">No accounts yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {list.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.name}</p>
                  <p className="text-sm text-zinc-500">
                    {a.type.replace('_', ' ').toLowerCase()}
                    {!a.isZakatable && ' · not zakatable'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums">
                    {formatCents(toCents(a.balance), a.currency)}
                  </span>
                  <Button
                    variant="ghost"
                    className="h-8 px-2 text-zinc-500"
                    aria-label={`Archive ${a.name}`}
                    disabled={archive.isPending}
                    onClick={() => archive.mutate(a.id)}
                  >
                    Archive
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Add an account">
        <AddAccountForm defaultCurrency={user?.currency ?? 'AED'} />
      </Card>
    </div>
  );
}
