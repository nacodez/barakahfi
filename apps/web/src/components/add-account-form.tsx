'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AccountType, createAccountSchema } from '@barakahfi/shared';
import type { z } from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { controlClass, Field, FormError } from '@/components/ui/field';
import { useCreateAccount } from '@/hooks/use-accounts';
import { cn } from '@/lib/cn';

type FormInput = z.input<typeof createAccountSchema>;
type FormOutput = z.output<typeof createAccountSchema>;

const LABELS: Record<AccountType, string> = {
  BANK: 'Bank account',
  INVESTMENT: 'Investment',
  CASH: 'Cash',
  GOLD: 'Gold',
  REAL_ESTATE: 'Real estate',
  CRYPTO: 'Crypto',
};

export function AddAccountForm({ defaultCurrency }: { defaultCurrency: string }) {
  // react-hook-form keeps field refs in a mutable store; the React Compiler would memoise
  // register() and break re-registration after reset(), so this component opts out.
  'use no memo';
  const create = useCreateAccount();
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: { type: 'BANK', currency: defaultCurrency, balance: '0.00', isZakatable: true },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      await create.mutateAsync(values);
      reset({
        type: values.type,
        currency: values.currency,
        balance: '0.00',
        isZakatable: true,
        name: '',
      });
    } catch {
      setFormError('Could not create the account. Please try again.');
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormError>{formError}</FormError>
      </div>
      <Field
        label="Account name"
        placeholder="e.g. ADCB Savings"
        error={errors.name?.message}
        {...register('name')}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="account-type" className="text-sm font-medium">
          Type
        </label>
        <select
          id="account-type"
          className={cn(controlClass, 'bg-background')}
          {...register('type')}
        >
          {Object.values(AccountType).map((t) => (
            <option key={t} value={t}>
              {LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <Field
        label="Currency"
        maxLength={3}
        className="uppercase"
        error={errors.currency?.message}
        {...register('currency')}
      />
      <Field
        label="Current balance"
        inputMode="decimal"
        error={errors.balance?.message}
        {...register('balance')}
      />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" className="size-4 accent-emerald-700" {...register('isZakatable')} />
        Include in zakat calculation
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" loading={create.isPending}>
          Add account
        </Button>
      </div>
    </form>
  );
}
