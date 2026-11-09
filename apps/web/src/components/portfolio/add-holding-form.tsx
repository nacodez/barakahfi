'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createHoldingSchema, type CreateHoldingInput } from '@barakahfi/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { useCreateHolding } from '@/hooks/use-portfolio';
import { ApiRequestError } from '@/lib/api';
import { today } from '@/lib/date';
import { AssetPicker } from './asset-picker';

type Output = z.output<typeof createHoldingSchema>;

export function AddHoldingForm({
  defaultSymbol = '',
  onDone,
}: {
  defaultSymbol?: string;
  onDone?: () => void;
}) {
  // react-hook-form + React Compiler: see add-account-form.tsx.
  'use no memo';
  const create = useCreateHolding();
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateHoldingInput, unknown, Output>({
    resolver: zodResolver(createHoldingSchema),
    defaultValues: {
      symbol: defaultSymbol,
      quantity: '',
      avgBuyPrice: '',
      purchaseDate: today(),
      dividendsReceived: '0',
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library
  const symbol = watch('symbol');

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      await create.mutateAsync(values);
      reset({
        symbol: '',
        quantity: '',
        avgBuyPrice: '',
        purchaseDate: today(),
        dividendsReceived: '0',
      });
      onDone?.();
    } catch (e) {
      setFormError(
        e instanceof ApiRequestError && e.status < 500
          ? e.message
          : 'Could not add the holding. Please try again.',
      );
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormError>{formError}</FormError>
      </div>
      <div className="sm:col-span-2">
        <AssetPicker
          value={symbol}
          onChange={(s) => setValue('symbol', s, { shouldValidate: true })}
          error={errors.symbol?.message}
        />
      </div>
      <Field
        label="Quantity"
        inputMode="decimal"
        placeholder="0"
        error={errors.quantity?.message}
        {...register('quantity')}
      />
      <Field
        label="Average buy price"
        inputMode="decimal"
        placeholder="0.00"
        error={errors.avgBuyPrice?.message}
        {...register('avgBuyPrice')}
      />
      <Field
        label="Purchase date"
        type="date"
        error={errors.purchaseDate?.message}
        {...register('purchaseDate')}
      />
      <Field
        label="Dividends received so far"
        inputMode="decimal"
        error={errors.dividendsReceived?.message}
        {...register('dividendsReceived')}
      />
      <div className="sm:col-span-2">
        <Button type="submit" loading={create.isPending}>
          Add holding
        </Button>
      </div>
    </form>
  );
}
