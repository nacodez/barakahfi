'use client';

import type { TransactionDto } from '@barakahfi/shared';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { useAccounts } from '@/hooks/use-accounts';
import { useCategories } from '@/hooks/use-categories';
import { useTransactionSummary } from '@/hooks/use-transactions';
import { monthRange } from '@/lib/date';
import { formatCents, toCents } from '@/lib/money';
import type { TransactionFilters } from '@/lib/transaction-utils';
import { TransactionFiltersBar } from './transaction-filters-bar';
import { TransactionForm } from './transaction-form';
import { TransactionList } from './transaction-list';

function MonthlySummary() {
  const summary = useTransactionSummary(monthRange());
  const month = new Date().toLocaleString('en', { month: 'long', year: 'numeric' });

  return (
    <Card title={`${month} so far`}>
      {summary.isPending ? (
        <p className="text-zinc-500">Loading…</p>
      ) : !summary.data?.length ? (
        <p className="text-zinc-500">Nothing recorded this month yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {summary.data.map((s) => (
            <dl key={s.currency} className="grid grid-cols-3 gap-4">
              {[
                ['Income', s.income, 'text-emerald-700 dark:text-emerald-400'],
                ['Expenses', s.expense, 'text-red-600 dark:text-red-400'],
                ['Net', s.net, ''],
              ].map(([label, value, color]) => (
                <div key={label}>
                  <dt className="text-sm text-zinc-500">{label}</dt>
                  <dd className={`text-lg font-semibold tabular-nums ${color}`}>
                    {formatCents(toCents(value!), s.currency)}
                  </dd>
                </div>
              ))}
            </dl>
          ))}
        </div>
      )}
    </Card>
  );
}

export function TransactionsView() {
  const accounts = useAccounts();
  const categories = useCategories();
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [editing, setEditing] = useState<TransactionDto | undefined>();

  const accountList = accounts.data ?? [];
  const categoryList = categories.data ?? [];
  const ready = accounts.isSuccess && categories.isSuccess;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Every entry updates your account balance automatically.
        </p>
      </div>

      <MonthlySummary />

      <Card title={editing ? 'Edit transaction' : 'Add a transaction'}>
        {!ready ? (
          <p className="text-zinc-500">Loading…</p>
        ) : (
          <TransactionForm
            // Remount when switching between add and edit so defaults are correct.
            key={editing?.id ?? 'new'}
            accounts={accountList}
            categories={categoryList}
            editing={editing}
            onDone={() => setEditing(undefined)}
          />
        )}
      </Card>

      <Card title="History">
        <div className="mb-4">
          <TransactionFiltersBar
            filters={filters}
            onChange={setFilters}
            accounts={accountList}
            categories={categoryList}
          />
        </div>
        <TransactionList
          filters={filters}
          onEdit={(t) => {
            setEditing(t);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </Card>
    </div>
  );
}
