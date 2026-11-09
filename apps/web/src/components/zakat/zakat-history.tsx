'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useUpdateZakatRecord, useZakatRecords } from '@/hooks/use-zakat';
import { formatCents, toCents } from '@/lib/money';

const money = (v: string, currency: string) => formatCents(toCents(v), currency);

export function ZakatHistory() {
  const records = useZakatRecords();
  const update = useUpdateZakatRecord();
  const [custom, setCustom] = useState<Record<string, string>>({});

  return (
    <Card title="Your zakat history">
      {records.isPending ? (
        <p className="text-zinc-500">Loading…</p>
      ) : records.isError ? (
        <p className="text-red-600">Could not load your history.</p>
      ) : records.data.length === 0 ? (
        <p className="text-zinc-500">
          Nothing saved yet. Save a calculation to keep track of what you owe and what you have
          paid.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {records.data.map((r) => {
            const remaining = toCents(r.zakatDue) - toCents(r.zakatPaid);
            const settled = Number(r.zakatDue) === 0 || remaining <= 0n;
            const typed = custom[r.id];
            const typedValid = typed !== undefined && /^\d{1,13}(\.\d{1,2})?$/.test(typed);
            return (
              <li key={r.id} className="flex flex-col gap-3 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {r.hijriYear} AH{' '}
                    <span className="font-normal text-zinc-500">
                      · {new Date(r.calculatedAt).toLocaleDateString('en', { dateStyle: 'medium' })}
                    </span>
                  </p>
                  <p className="text-sm text-zinc-500">
                    {r.nisabMethod === 'GOLD' ? 'Gold' : 'Silver'} nisab
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-zinc-500">Due</dt>
                    <dd className="font-semibold tabular-nums">{money(r.zakatDue, r.currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Paid</dt>
                    <dd className="font-semibold tabular-nums">{money(r.zakatPaid, r.currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Remaining</dt>
                    <dd className="font-semibold tabular-nums">
                      {settled ? 'Settled' : formatCents(remaining, r.currency)}
                    </dd>
                  </div>
                </dl>
                {r.notes && <p className="text-sm text-zinc-500">{r.notes}</p>}
                {Number(r.zakatDue) > 0 && !settled && (
                  <div className="flex flex-wrap items-end gap-2">
                    <Button
                      className="h-9"
                      onClick={() => update.mutate({ id: r.id, zakatPaid: r.zakatDue })}
                    >
                      Mark as paid in full
                    </Button>
                    <div className="flex items-center gap-2">
                      <input
                        aria-label={`Amount paid for ${r.hijriYear} AH`}
                        inputMode="decimal"
                        placeholder="Amount paid"
                        value={typed ?? ''}
                        onChange={(e) => setCustom({ ...custom, [r.id]: e.target.value })}
                        className="h-9 w-36 rounded-lg border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
                      />
                      <Button
                        variant="outline"
                        className="h-9"
                        disabled={!typedValid}
                        onClick={() => update.mutate({ id: r.id, zakatPaid: typed! })}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
