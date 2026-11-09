'use client';

import {
  NON_NEGATIVE_AMOUNT_REGEX,
  PRICE_REGEX,
  QUANTITY_REGEX,
  type HoldingDto,
} from '@barakahfi/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { useUpdateHolding } from '@/hooks/use-portfolio';
import { ApiRequestError } from '@/lib/api';

/** Small inline editor: change what you hold, what you paid, or the dividends received. */
export function HoldingEdit({ holding, onDone }: { holding: HoldingDto; onDone: () => void }) {
  const update = useUpdateHolding();
  const [quantity, setQuantity] = useState(holding.quantity);
  const [avg, setAvg] = useState(holding.avgBuyPrice);
  const [dividends, setDividends] = useState(holding.dividendsReceived);
  const [error, setError] = useState('');

  const problems = {
    quantity: QUANTITY_REGEX.test(quantity) ? '' : 'Greater than 0, up to 6 decimals',
    avg: PRICE_REGEX.test(avg) ? '' : 'Greater than 0, up to 4 decimals',
    dividends: NON_NEGATIVE_AMOUNT_REGEX.test(dividends) ? '' : '0 or more, up to 2 decimals',
  };
  const invalid = Object.values(problems).some(Boolean);

  const save = async () => {
    setError('');
    try {
      await update.mutateAsync({
        id: holding.id,
        quantity,
        avgBuyPrice: avg,
        dividendsReceived: dividends,
      });
      onDone();
    } catch (e) {
      setError(
        e instanceof ApiRequestError && e.status < 500
          ? e.message
          : 'Could not save. Please try again.',
      );
    }
  };

  return (
    <div className="grid gap-3 rounded-lg bg-zinc-50 p-4 sm:grid-cols-3 dark:bg-zinc-900">
      <div className="sm:col-span-3">
        <FormError>{error}</FormError>
      </div>
      <Field
        label="Quantity"
        inputMode="decimal"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        error={problems.quantity}
      />
      <Field
        label="Average buy price"
        inputMode="decimal"
        value={avg}
        onChange={(e) => setAvg(e.target.value)}
        error={problems.avg}
      />
      <Field
        label={`Dividends received (${holding.currency})`}
        inputMode="decimal"
        value={dividends}
        onChange={(e) => setDividends(e.target.value)}
        error={problems.dividends}
      />
      <div className="flex gap-2 sm:col-span-3">
        <Button onClick={() => void save()} disabled={invalid} loading={update.isPending}>
          Save
        </Button>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
