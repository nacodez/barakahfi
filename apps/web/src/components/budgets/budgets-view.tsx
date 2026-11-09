'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  BudgetPeriod,
  createBudgetSchema,
  type BudgetDto,
  type CreateBudgetInput,
} from '@barakahfi/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { BudgetChart } from '@/components/charts/budget-chart';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { controlClass, Field, FormError } from '@/components/ui/field';
import { useCategories } from '@/hooks/use-categories';
import { useMe } from '@/hooks/use-auth';
import { useBudgets, useCreateBudget, useDeleteBudget, useUpdateBudget } from '@/hooks/use-budgets';
import { ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { monthRange } from '@/lib/date';
import { formatCents, toCents } from '@/lib/money';
import { BudgetBar, STATUS_TEXT } from './budget-bar';

type Output = z.output<typeof createBudgetSchema>;

function BudgetCard({ b, currency }: { b: BudgetDto; currency: string }) {
  const update = useUpdateBudget();
  const remove = useDeleteBudget();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(b.amount);
  const [error, setError] = useState('');
  const money = (v: string) => formatCents(toCents(v), currency);

  const save = async () => {
    setError('');
    try {
      await update.mutateAsync({ id: b.id, amount });
      setEditing(false);
    } catch (e) {
      setError(
        e instanceof ApiRequestError && e.status < 500
          ? 'Enter an amount greater than 0 with up to 2 decimals.'
          : 'Could not save.',
      );
    }
  };

  return (
    <li className="py-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            <span aria-hidden className="mr-1.5">
              {b.categoryIcon}
            </span>
            {b.categoryName}
          </p>
          <p className="text-sm text-zinc-500">
            {b.period.toLowerCase()} · {b.windowStart} to {b.windowEnd}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            className="h-8 px-2 text-zinc-500"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Cancel' : 'Edit'}
          </Button>
          <Button
            variant="ghost"
            className="h-8 px-2 text-zinc-500"
            aria-label={`Delete ${b.categoryName} budget`}
            onClick={() =>
              window.confirm(`Delete the ${b.categoryName} budget?`) && remove.mutate(b.id)
            }
          >
            Delete
          </Button>
        </div>
      </div>

      <BudgetBar percent={b.percent} status={b.status} label={`${b.categoryName} budget`} />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="tabular-nums">
          {money(b.spent)} of {money(b.amount)}
        </span>
        <span
          className={cn(
            'font-medium',
            b.status === 'ON_TRACK' && 'text-emerald-700 dark:text-emerald-400',
            b.status === 'WARNING' && 'text-amber-600 dark:text-amber-400',
            b.status === 'OVER' && 'text-red-600 dark:text-red-400',
          )}
        >
          {STATUS_TEXT[b.status]} · {b.percent}% ·{' '}
          {Number(b.remaining) >= 0
            ? `${money(b.remaining)} left`
            : `${money(b.remaining.replace('-', ''))} over`}
        </span>
      </div>

      {editing && (
        <div className="mt-3 flex items-end gap-2">
          <div className="w-40">
            <Field
              label="Budget amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={error}
            />
          </div>
          <Button onClick={() => void save()} loading={update.isPending}>
            Save
          </Button>
        </div>
      )}
    </li>
  );
}

function AddBudgetForm() {
  // react-hook-form + React Compiler: see add-account-form.tsx.
  'use no memo';
  const categories = useCategories();
  const create = useCreateBudget();
  const [formError, setFormError] = useState('');
  const expense = (categories.data ?? []).filter((c) => c.type === 'EXPENSE');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateBudgetInput, unknown, Output>({
    resolver: zodResolver(createBudgetSchema),
    defaultValues: { categoryId: '', amount: '', period: 'MONTHLY', startDate: monthRange().from },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      await create.mutateAsync(values);
      reset({ categoryId: '', amount: '', period: values.period, startDate: values.startDate });
    } catch (e) {
      setFormError(
        e instanceof ApiRequestError && e.status === 409
          ? 'You already have a budget for this category and period.'
          : 'Could not create the budget. Please try again.',
      );
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormError>{formError}</FormError>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="budget-category" className="text-sm font-medium">
          Category
        </label>
        <select
          id="budget-category"
          className={cn(controlClass, 'bg-background')}
          aria-invalid={errors.categoryId ? true : undefined}
          {...register('categoryId')}
        >
          <option value="">Choose…</option>
          {expense.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        {errors.categoryId && (
          <p role="alert" className="text-sm text-red-600">
            {errors.categoryId.message}
          </p>
        )}
      </div>
      <Field
        label="Limit"
        inputMode="decimal"
        placeholder="0.00"
        error={errors.amount?.message}
        {...register('amount')}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="budget-period" className="text-sm font-medium">
          Period
        </label>
        <select
          id="budget-period"
          className={cn(controlClass, 'bg-background')}
          {...register('period')}
        >
          {Object.values(BudgetPeriod).map((p) => (
            <option key={p} value={p}>
              {p.charAt(0) + p.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      <Field
        label="Starts on"
        type="date"
        error={errors.startDate?.message}
        {...register('startDate')}
      />
      <div className="sm:col-span-2">
        <Button type="submit" loading={create.isPending}>
          Add budget
        </Button>
      </div>
    </form>
  );
}

export function BudgetsView() {
  const { data: user } = useMe();
  const budgets = useBudgets();
  const currency = user?.currency ?? 'AED';
  const list = budgets.data ?? [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Limits per category. Spending is counted from your {currency} accounts.
        </p>
      </div>

      {list.length > 0 && (
        <Card title="Budgeted vs spent">
          <BudgetChart budgets={list} currency={currency} />
        </Card>
      )}

      <Card title="Your budgets">
        {budgets.isPending ? (
          <p className="text-zinc-500">Loading…</p>
        ) : budgets.isError ? (
          <p className="text-red-600">Could not load budgets.</p>
        ) : list.length === 0 ? (
          <p className="text-zinc-500">No budgets yet. Add one below.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {list.map((b) => (
              <BudgetCard key={b.id} b={b} currency={currency} />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Add a budget">
        <AddBudgetForm />
      </Card>
    </div>
  );
}
