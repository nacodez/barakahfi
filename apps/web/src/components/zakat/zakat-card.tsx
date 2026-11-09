'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { controlClass } from '@/components/ui/field';
import { useUpdateProfile } from '@/hooks/use-auth';
import { useZakatSummary } from '@/hooks/use-zakat';
import { today } from '@/lib/date';
import { formatCents, toCents } from '@/lib/money';

const money = (v: string, currency: string) => formatCents(toCents(v), currency);

/** Dashboard card: where the zakat year stands and a rough estimate. The wizard gives the real figure. */
export function ZakatCard() {
  const summary = useZakatSummary();
  const update = useUpdateProfile();
  const [date, setDate] = useState('');
  const s = summary.data;

  const days = s?.daysRemaining;
  const status =
    days === null || days === undefined
      ? null
      : days > 0
        ? `${days} ${days === 1 ? 'day' : 'days'} until your zakat year completes`
        : days === 0
          ? 'Your zakat year completes today'
          : `Your zakat year completed ${-days} ${days === -1 ? 'day' : 'days'} ago`;

  return (
    <Card
      title="Zakat"
      action={
        <Link
          href="/zakat"
          className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Calculate
        </Link>
      }
    >
      {summary.isPending ? (
        <p className="text-zinc-500">Loading…</p>
      ) : summary.isError || !s ? (
        <p className="text-zinc-500">The zakat estimate is unavailable right now.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {status ? (
            <p className="font-medium">{status}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <label htmlFor="hawl-start" className="text-sm">
                When did your zakat year start? (the date your wealth first reached the nisab)
              </label>
              <div className="flex gap-2">
                <input
                  id="hawl-start"
                  type="date"
                  max={today()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={controlClass}
                />
                <Button
                  variant="outline"
                  disabled={!date}
                  loading={update.isPending}
                  onClick={() => update.mutate({ zakatStartDate: date })}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
          <div>
            <p className="text-sm text-zinc-500">
              Estimated zakat on your zakatable accounts and investments
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {s.meetsNisab ? money(s.estimatedZakat, s.currency) : 'Below the nisab'}
            </p>
            {!s.meetsNisab && (
              <p className="text-sm text-zinc-500">
                Nisab: {money(s.nisabUsed, s.currency)} (
                {s.nisabMethod === 'GOLD' ? 'gold' : 'silver'})
              </p>
            )}
          </div>
          {s.latestRecord && Number(s.latestRecord.zakatDue) > 0 && (
            <p className="text-sm text-zinc-500">
              Last saved ({s.latestRecord.hijriYear} AH):{' '}
              {money(s.latestRecord.zakatPaid, s.currency)} paid of{' '}
              {money(s.latestRecord.zakatDue, s.currency)}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
