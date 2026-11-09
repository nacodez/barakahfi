'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createTransactionSchema,
  type AccountDto,
  type CategoryDto,
  type CreateTransactionInput,
  type TransactionDto,
} from '@barakahfi/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { halalHint } from '@/components/halal-badge';
import { Button } from '@/components/ui/button';
import { controlClass, Field, FormError } from '@/components/ui/field';
import { ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { today } from '@/lib/date';
import { useCreateTransaction, useUpdateTransaction } from '@/hooks/use-transactions';

type Output = z.output<typeof createTransactionSchema>;

const TYPES = [
  { value: 'EXPENSE', label: 'Expense' },
  { value: 'INCOME', label: 'Income' },
  { value: 'TRANSFER', label: 'Transfer' },
] as const;

const blank = (accountId: string): CreateTransactionInput => ({
  type: 'EXPENSE',
  accountId,
  transferAccountId: null,
  categoryId: null,
  amount: '',
  description: '',
  date: today(),
});

const fromTransaction = (t: TransactionDto): CreateTransactionInput => ({
  type: t.type,
  accountId: t.accountId,
  transferAccountId: t.transferAccountId,
  categoryId: t.categoryId,
  amount: t.amount,
  description: t.description,
  date: t.date,
});

const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : (v as string));

interface Props {
  accounts: AccountDto[];
  categories: CategoryDto[];
  editing?: TransactionDto;
  onDone?: () => void;
}

export function TransactionForm({ accounts, categories, editing, onDone }: Props) {
  // react-hook-form + React Compiler: see add-account-form.tsx.
  'use no memo';
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const [formError, setFormError] = useState('');
  const firstAccount = accounts[0]?.id ?? '';

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateTransactionInput, unknown, Output>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: editing ? fromTransaction(editing) : blank(firstAccount),
  });

  // watch() can't be memoised; this component already opts out of the compiler with 'use no memo'.
  // eslint-disable-next-line react-hooks/incompatible-library
  const type = watch('type');
  const sourceId = watch('accountId');
  const categoryOptions = categories.filter((c) => c.type === type);
  const pending = create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input: values });
      else await create.mutateAsync(values);
      reset(blank(values.accountId));
      onDone?.();
    } catch (e) {
      setFormError(
        e instanceof ApiRequestError && e.status < 500
          ? e.message
          : 'Could not save the transaction. Please try again.',
      );
    }
  });

  if (accounts.length === 0) {
    return (
      <p className="text-zinc-500">
        Add an account on the dashboard first, then you can record transactions.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormError>{formError}</FormError>
      </div>

      <fieldset className="sm:col-span-2">
        <legend className="sr-only">Transaction type</legend>
        <div className="inline-flex rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700">
          {TYPES.map((t) => (
            <label
              key={t.value}
              className={cn(
                'cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                'has-[:checked]:bg-emerald-700 has-[:checked]:text-white',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-emerald-600',
              )}
            >
              <input
                type="radio"
                value={t.value}
                className="sr-only"
                {...register('type', { onChange: () => setValue('categoryId', null) })}
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Amount"
        inputMode="decimal"
        placeholder="0.00"
        error={errors.amount?.message}
        {...register('amount')}
      />
      <Field label="Date" type="date" error={errors.date?.message} {...register('date')} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="tx-account" className="text-sm font-medium">
          {type === 'TRANSFER' ? 'From account' : 'Account'}
        </label>
        <select
          id="tx-account"
          className={cn(controlClass, 'bg-background')}
          {...register('accountId')}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </select>
        {errors.accountId && (
          <p role="alert" className="text-sm text-red-600">
            {errors.accountId.message}
          </p>
        )}
      </div>

      {type === 'TRANSFER' ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tx-to" className="text-sm font-medium">
            To account
          </label>
          <select
            id="tx-to"
            className={cn(controlClass, 'bg-background')}
            {...register('transferAccountId', { setValueAs: emptyToNull })}
          >
            <option value="">Choose…</option>
            {accounts
              .filter((a) => a.id !== sourceId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
          </select>
          {errors.transferAccountId && (
            <p role="alert" className="text-sm text-red-600">
              {errors.transferAccountId.message}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tx-category" className="text-sm font-medium">
            Category
          </label>
          <select
            id="tx-category"
            className={cn(controlClass, 'bg-background')}
            {...register('categoryId', { setValueAs: emptyToNull })}
          >
            <option value="">No category</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
                {halalHint(c.halalStatus)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="sm:col-span-2">
        <Field
          label="Note (optional)"
          maxLength={255}
          error={errors.description?.message}
          {...register('description')}
        />
      </div>

      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={pending}>
          {editing ? 'Save changes' : 'Add transaction'}
        </Button>
        {editing && (
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
