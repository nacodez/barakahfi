'use client';

import type { AccountDto, CategoryDto } from '@barakahfi/shared';
import { Button } from '@/components/ui/button';
import { controlClass } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import type { TransactionFilters } from '@/lib/transaction-utils';

interface Props {
  filters: TransactionFilters;
  onChange: (f: TransactionFilters) => void;
  accounts: AccountDto[];
  categories: CategoryDto[];
}

const select = cn(controlClass, 'bg-background');

export function TransactionFiltersBar({ filters, onChange, accounts, categories }: Props) {
  const set = (patch: Partial<TransactionFilters>) => onChange({ ...filters, ...patch });
  const active = Object.values(filters).some(Boolean);

  return (
    <div
      role="search"
      aria-label="Filter transactions"
      className="grid grid-cols-2 gap-3 md:grid-cols-5"
    >
      <label className="flex flex-col gap-1 text-sm">
        Type
        <select
          className={select}
          value={filters.type ?? ''}
          onChange={(e) => set({ type: e.target.value as TransactionFilters['type'] })}
        >
          <option value="">All</option>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
          <option value="TRANSFER">Transfer</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Account
        <select
          className={select}
          value={filters.accountId ?? ''}
          onChange={(e) => set({ accountId: e.target.value })}
        >
          <option value="">All</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Category
        <select
          className={select}
          value={filters.categoryId ?? ''}
          onChange={(e) => set({ categoryId: e.target.value })}
        >
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        From
        <input
          type="date"
          className={controlClass}
          value={filters.from ?? ''}
          max={filters.to || undefined}
          onChange={(e) => set({ from: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        To
        <input
          type="date"
          className={controlClass}
          value={filters.to ?? ''}
          min={filters.from || undefined}
          onChange={(e) => set({ to: e.target.value })}
        />
      </label>
      {active && (
        <div className="col-span-2 md:col-span-5">
          <Button variant="ghost" className="h-8 px-2" onClick={() => onChange({})}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
