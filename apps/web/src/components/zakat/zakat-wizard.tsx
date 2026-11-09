'use client';

import type { CalculateZakatInput, ZakatCalculationDto, ZakatContextDto } from '@barakahfi/shared';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ComplianceBadge } from '@/components/compliance-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, FormError } from '@/components/ui/field';
import { useCalculateZakat, useSaveZakat, useZakatContext } from '@/hooks/use-zakat';
import { cn } from '@/lib/cn';
import { formatCents, toCents } from '@/lib/money';

const AMOUNT = /^\d{1,13}(\.\d{1,2})?$/;
const GRAMS = /^\d{1,7}(\.\d{1,3})?$/;
const STEPS = ['Accounts', 'Other assets', 'Debts', 'Result'] as const;

interface Manual {
  cashOnHand: string;
  receivables: string;
  goldJewelryGrams: string;
  silverGrams: string;
  otherAssets: string;
  liabilities: string;
}
const BLANK: Manual = {
  cashOnHand: '0',
  receivables: '0',
  goldJewelryGrams: '0',
  silverGrams: '0',
  otherAssets: '0',
  liabilities: '0',
};

function Steps({ step }: { step: number }) {
  return (
    <ol aria-label="Progress" className="flex items-center gap-2 overflow-x-auto pb-1">
      {STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li
            key={label}
            aria-current={current ? 'step' : undefined}
            className="flex shrink-0 items-center gap-2"
          >
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full text-sm font-medium',
                done && 'bg-emerald-700 text-white',
                current && 'border-2 border-emerald-700 text-emerald-800 dark:text-emerald-300',
                !done && !current && 'border border-zinc-300 text-zinc-500 dark:border-zinc-700',
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className={cn('text-sm', current ? 'font-medium' : 'text-zinc-500')}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="mx-1 h-px w-4 bg-zinc-300 dark:bg-zinc-700" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

const money = (v: string, currency: string) => formatCents(toCents(v), currency);

function Result({
  calc,
  onMethod,
  onSave,
  saving,
  saved,
  savedDue,
  error,
}: {
  calc: ZakatCalculationDto;
  onMethod: (m: 'GOLD' | 'SILVER') => void;
  onSave: (notes: string) => void;
  saving: boolean;
  saved: boolean;
  /** What the server actually stored (it recalculates on save). */
  savedDue?: string;
  error: string;
}) {
  const [notes, setNotes] = useState('');
  const c = calc.currency;

  return (
    <div className="flex flex-col gap-6">
      <div
        className="rounded-xl bg-emerald-50 p-5 text-center dark:bg-emerald-950"
        aria-live="polite"
      >
        <p className="text-sm text-emerald-900 dark:text-emerald-200">
          {calc.meetsNisab ? 'Zakat due' : 'No zakat due'}
        </p>
        <p className="text-4xl font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">
          {money(calc.zakatDue, c)}
        </p>
        <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-200/80">
          {calc.meetsNisab
            ? `2.5% of ${money(calc.netWealth, c)}`
            : `Your zakatable wealth (${money(calc.netWealth, c)}) is below the nisab of ${money(calc.nisabUsed, c)}.`}
        </p>
      </div>

      <section aria-label="Nisab">
        <h3 className="mb-2 font-semibold">Nisab (the minimum for zakat to be due)</h3>
        <div role="radiogroup" aria-label="Nisab method" className="grid gap-3 sm:grid-cols-2">
          {(['GOLD', 'SILVER'] as const).map((m) => {
            const value = m === 'GOLD' ? calc.nisabGold : calc.nisabSilver;
            const met = Number(calc.netWealth) >= Number(value) && Number(calc.netWealth) > 0;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={calc.nisabMethod === m}
                onClick={() => onMethod(m)}
                className={cn(
                  'rounded-xl border p-4 text-left transition-colors',
                  calc.nisabMethod === m
                    ? 'border-emerald-700 bg-emerald-50 dark:bg-emerald-950'
                    : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900',
                )}
              >
                <p className="text-sm text-zinc-500">
                  {m === 'GOLD' ? '85 g of gold' : '595 g of silver'}
                </p>
                <p className="text-lg font-semibold tabular-nums">{money(value, c)}</p>
                <p className="text-sm">
                  {met ? 'Your wealth reaches it' : 'Your wealth is below it'}
                </p>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          Scholars differ on which to use. The silver nisab is lower, so more people owe zakat under
          it.
        </p>
      </section>

      <section aria-label="Breakdown">
        <h3 className="mb-2 font-semibold">Breakdown</h3>
        <dl className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {calc.items.length === 0 && <p className="py-2 text-zinc-500">Nothing was included.</p>}
          {calc.items.map((i, idx) => (
            <div key={`${i.kind}-${idx}`} className="flex justify-between gap-3 py-2">
              <dt>{i.label}</dt>
              <dd className="tabular-nums">{money(i.amount, c)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 py-2 font-medium">
            <dt>Total assets</dt>
            <dd className="tabular-nums">{money(calc.assetsTotal, c)}</dd>
          </div>
          <div className="flex justify-between gap-3 py-2">
            <dt>Debts due this year</dt>
            <dd className="tabular-nums">−{money(calc.liabilities, c)}</dd>
          </div>
          <div className="flex justify-between gap-3 py-2 font-semibold">
            <dt>Zakatable wealth</dt>
            <dd className="tabular-nums">{money(calc.netWealth, c)}</dd>
          </div>
        </dl>
      </section>

      <p className="text-sm text-zinc-500">
        Metal prices: gold {money(calc.goldPricePerGram, c)}/g and silver{' '}
        {money(calc.silverPricePerGram, c)}/g, as of{' '}
        {new Date(calc.pricesAsOf).toLocaleString('en', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}
        {calc.pricesSource === 'cached'
          ? ' (the live feed was unavailable, so the last known price was used)'
          : ''}
        . Gold is priced as pure (24k) metal.
      </p>

      {saved ? (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        >
          Saved{savedDue ? ` at ${money(savedDue, c)}` : ''}.{' '}
          {savedDue && savedDue !== calc.zakatDue
            ? `Prices moved since the preview (${money(calc.zakatDue, c)}), so it was recalculated with the latest ones. `
            : ''}
          Find it in your history below, where you can record what you have paid.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <FormError>{error}</FormError>
          <Field
            label="Note (optional)"
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Ramadan 1448"
          />
          <div>
            <Button onClick={() => onSave(notes)} loading={saving}>
              Save this calculation
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ZakatWizard() {
  const context = useZakatContext();
  const calculate = useCalculateZakat();
  const save = useSaveZakat();

  const [step, setStep] = useState(0);
  const [accountSel, setAccountSel] = useState<Set<string> | null>(null);
  const [holdingSel, setHoldingSel] = useState<Set<string> | null>(null);
  const [manual, setManual] = useState<Manual>(BLANK);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  if (context.isPending)
    return (
      <Card title="Calculate your zakat">
        <p className="text-zinc-500">Loading…</p>
      </Card>
    );
  if (context.isError) {
    return (
      <Card title="Calculate your zakat">
        <div className="flex items-center gap-3">
          <p className="text-red-600">Could not load your accounts or the metal prices.</p>
          <Button variant="outline" onClick={() => void context.refetch()}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  const ctx: ZakatContextDto = context.data;
  // Sensible defaults until the user changes them: zakatable accounts, and every holding.
  const accounts =
    accountSel ?? new Set(ctx.accounts.filter((a) => a.isZakatable).map((a) => a.id));
  const holdings = holdingSel ?? new Set(ctx.holdings.map((h) => h.id));
  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };
  const set = (key: keyof Manual) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setManual({ ...manual, [key]: e.target.value });

  const selectedTotal = [
    ...ctx.accounts.filter((a) => accounts.has(a.id)).map((a) => a.balanceBase),
    ...ctx.holdings.filter((h) => holdings.has(h.id)).map((h) => h.valueBase),
  ].reduce((sum, v) => sum + toCents(v), 0n);

  const errors = {
    cashOnHand: AMOUNT.test(manual.cashOnHand) ? '' : 'Enter 0 or more, up to 2 decimals',
    receivables: AMOUNT.test(manual.receivables) ? '' : 'Enter 0 or more, up to 2 decimals',
    goldJewelryGrams: GRAMS.test(manual.goldJewelryGrams) ? '' : 'Enter grams, up to 3 decimals',
    silverGrams: GRAMS.test(manual.silverGrams) ? '' : 'Enter grams, up to 3 decimals',
    otherAssets: AMOUNT.test(manual.otherAssets) ? '' : 'Enter 0 or more, up to 2 decimals',
    liabilities: AMOUNT.test(manual.liabilities) ? '' : 'Enter 0 or more, up to 2 decimals',
  };
  const step2Valid =
    !errors.cashOnHand &&
    !errors.receivables &&
    !errors.goldJewelryGrams &&
    !errors.silverGrams &&
    !errors.otherAssets;

  const payload = (method?: 'GOLD' | 'SILVER'): CalculateZakatInput => ({
    accountIds: [...accounts],
    holdingIds: [...holdings],
    ...manual,
    ...(method && { nisabMethod: method }),
  });
  const run = (method?: 'GOLD' | 'SILVER') => {
    setSaved(false);
    calculate.mutate(payload(method));
  };
  const goToResult = () => {
    setStep(3);
    run(calculate.data?.nisabMethod);
  };
  const doSave = (notes: string) => {
    setSaveError('');
    save.mutate(
      { ...payload(calculate.data?.nisabMethod), ...(notes.trim() && { notes: notes.trim() }) },
      {
        onSuccess: () => setSaved(true),
        onError: () => setSaveError('Could not save. Please try again.'),
      },
    );
  };

  return (
    <Card title="Calculate your zakat">
      <div className="flex flex-col gap-6">
        <Steps step={step} />

        {step === 0 && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Tick what to include. Accounts marked zakatable and all your holdings are selected for
              you. Values are converted to {ctx.currency}.
            </p>
            <fieldset>
              <legend className="mb-2 font-semibold">Accounts</legend>
              {ctx.accounts.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No accounts yet.{' '}
                  <Link
                    href="/dashboard"
                    className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    Add one on the dashboard
                  </Link>
                  , or enter amounts in the next step.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {ctx.accounts.map((a) => (
                    <li key={a.id}>
                      <label className="flex cursor-pointer items-center gap-3 py-3">
                        <input
                          type="checkbox"
                          className="size-5 accent-emerald-700"
                          checked={accounts.has(a.id)}
                          onChange={() => setAccountSel(toggle(accounts, a.id))}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{a.name}</span>
                          <span className="text-sm text-zinc-500">
                            {a.type.replace('_', ' ').toLowerCase()}
                            {!a.isZakatable ? ' · marked not zakatable' : ''}
                          </span>
                        </span>
                        <span className="text-right tabular-nums">
                          {money(a.balanceBase, ctx.currency)}
                          {a.currency !== ctx.currency && (
                            <span className="block text-xs text-zinc-500">
                              {money(a.balance, a.currency)}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
            <fieldset>
              <legend className="mb-2 font-semibold">Investments</legend>
              {ctx.holdings.length === 0 ? (
                <p className="text-sm text-zinc-500">No holdings yet.</p>
              ) : (
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {ctx.holdings.map((h) => (
                    <li key={h.id}>
                      <label className="flex cursor-pointer items-center gap-3 py-3">
                        <input
                          type="checkbox"
                          className="size-5 accent-emerald-700"
                          checked={holdings.has(h.id)}
                          onChange={() => setHoldingSel(toggle(holdings, h.id))}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {h.symbol} <span className="font-normal text-zinc-500">· {h.name}</span>
                          </span>
                          <ComplianceBadge status={h.status} />
                        </span>
                        <span className="tabular-nums">{money(h.valueBase, ctx.currency)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
            <p className="text-right font-medium tabular-nums">
              Selected so far: {formatCents(selectedTotal, ctx.currency)}
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <p className="text-sm text-zinc-600 sm:col-span-2 dark:text-zinc-400">
              Add anything not already counted above. Leave a field at 0 if it does not apply.
            </p>
            <Field
              label={`Cash on hand (${ctx.currency})`}
              inputMode="decimal"
              value={manual.cashOnHand}
              onChange={set('cashOnHand')}
              error={errors.cashOnHand}
            />
            <Field
              label={`Money owed to you (${ctx.currency})`}
              inputMode="decimal"
              value={manual.receivables}
              onChange={set('receivables')}
              error={errors.receivables}
            />
            <div>
              <Field
                label="Gold jewellery and bullion (grams)"
                inputMode="decimal"
                value={manual.goldJewelryGrams}
                onChange={set('goldJewelryGrams')}
                error={errors.goldJewelryGrams}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Today: {money(ctx.goldPricePerGram, ctx.currency)} per gram of pure gold.
              </p>
            </div>
            <div>
              <Field
                label="Silver (grams)"
                inputMode="decimal"
                value={manual.silverGrams}
                onChange={set('silverGrams')}
                error={errors.silverGrams}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Today: {money(ctx.silverPricePerGram, ctx.currency)} per gram.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Field
                label={`Other zakatable assets, e.g. business stock (${ctx.currency})`}
                inputMode="decimal"
                value={manual.otherAssets}
                onChange={set('otherAssets')}
                error={errors.otherAssets}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex max-w-md flex-col gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Debts you must repay within the coming year (loan instalments, bills, rent owed). They
              are subtracted from your wealth.
            </p>
            <Field
              label={`Debts due within the year (${ctx.currency})`}
              inputMode="decimal"
              value={manual.liabilities}
              onChange={set('liabilities')}
              error={errors.liabilities}
            />
          </div>
        )}

        {step === 3 &&
          (calculate.isPending ? (
            <p className="text-zinc-500" aria-busy="true">
              Calculating…
            </p>
          ) : calculate.isError ? (
            <div className="flex items-center gap-3">
              <p className="text-red-600">
                Could not calculate. The metal price feed may be unavailable.
              </p>
              <Button variant="outline" onClick={() => run()}>
                Try again
              </Button>
            </div>
          ) : calculate.data ? (
            <Result
              calc={calculate.data}
              onMethod={(m) => run(m)}
              onSave={doSave}
              saving={save.isPending}
              saved={saved}
              savedDue={save.data?.zakatDue}
              error={saveError}
            />
          ) : null)}

        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Back
          </Button>
          {step < 2 && (
            <Button onClick={() => setStep((s) => s + 1)} disabled={step === 1 && !step2Valid}>
              Next
            </Button>
          )}
          {step === 2 && (
            <Button onClick={goToResult} disabled={!!errors.liabilities}>
              Calculate
            </Button>
          )}
          {step === 3 && (
            <Button
              variant="outline"
              onClick={() => {
                setStep(0);
                setSaved(false);
              }}
            >
              Start over
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
