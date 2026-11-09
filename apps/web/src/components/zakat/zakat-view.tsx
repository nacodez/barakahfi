'use client';

import { ZakatHistory } from './zakat-history';
import { ZakatWizard } from './zakat-wizard';

export function ZakatView() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Zakat</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Work out what you owe in four steps, using your own balances and today&apos;s gold and
          silver prices.
        </p>
      </div>
      <p
        role="note"
        className="rounded-lg border border-zinc-200 p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
      >
        This is an estimate using commonly accepted rules: the nisab is 85 g of gold or 595 g of
        silver, and the rate is 2.5% once your wealth has been above it for a lunar year. Scholars
        differ on details such as how to treat shares and jewellery, so check with someone qualified
        for your situation.
      </p>
      <ZakatWizard />
      <ZakatHistory />
    </div>
  );
}
