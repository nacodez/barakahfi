'use client';

import { useMe } from '@/hooks/use-auth';
import { useAccounts, useArchiveAccount } from '@/hooks/use-accounts';
import { AddAccountForm } from '@/components/add-account-form';
import { Button } from '@/components/ui/button';
import { formatCents, toCents, totalsByCurrency } from '@/lib/money';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function DashboardView() {
  const { data: user } = useMe();
  const accounts = useAccounts();
  const archive = useArchiveAccount();

  const list = accounts.data ?? [];
  const totals = totalsByCurrency(list);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Assalamu alaikum{user ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">Here is where your wealth stands today.</p>
      </div>

      <Card title="Net worth">
        {accounts.isPending ? (
          <p className="text-zinc-500">Loading…</p>
        ) : totals.length === 0 ? (
          <p className="text-zinc-500">Add an account below to see your net worth.</p>
        ) : (
          <ul className="flex flex-wrap gap-x-10 gap-y-2">
            {totals.map((t) => (
              <li key={t.currency} className="text-3xl font-semibold tabular-nums">
                {formatCents(t.cents, t.currency)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Accounts">
        {accounts.isError ? (
          <p className="text-red-600">Could not load accounts.</p>
        ) : list.length === 0 && !accounts.isPending ? (
          <p className="text-zinc-500">No accounts yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {list.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.name}</p>
                  <p className="text-sm text-zinc-500">
                    {a.type.replace('_', ' ').toLowerCase()}
                    {!a.isZakatable && ' · not zakatable'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums">
                    {formatCents(toCents(a.balance), a.currency)}
                  </span>
                  <Button
                    variant="ghost"
                    className="h-8 px-2 text-zinc-500"
                    aria-label={`Archive ${a.name}`}
                    disabled={archive.isPending}
                    onClick={() => archive.mutate(a.id)}
                  >
                    Archive
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Add an account">
        <AddAccountForm defaultCurrency={user?.currency ?? 'AED'} />
      </Card>
    </div>
  );
}
