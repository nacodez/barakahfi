'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useLogout, useMe } from '@/hooks/use-auth';
import { ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', ready: true },
  { href: '#', label: 'Transactions', ready: false },
  { href: '#', label: 'Budgets', ready: false },
  { href: '#', label: 'Portfolio', ready: false },
  { href: '#', label: 'Halal screener', ready: false },
  { href: '#', label: 'Zakat', ready: false },
  { href: '#', label: 'Reports', ready: false },
  { href: '#', label: 'Settings', ready: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const logout = useLogout();

  const unauthenticated = me.error instanceof ApiRequestError && me.error.status === 401;
  useEffect(() => {
    if (unauthenticated) router.replace('/login');
  }, [unauthenticated, router]);

  if (me.isPending || unauthenticated) {
    return (
      <div className="flex flex-1 items-center justify-center" aria-busy="true">
        <span className="size-6 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
      </div>
    );
  }

  if (me.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-medium">We can&apos;t reach the server right now.</p>
        <Button variant="outline" onClick={() => void me.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const onLogout = () => logout.mutate(undefined, { onSettled: () => router.replace('/login') });

  return (
    <div className="flex flex-1">
      <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-zinc-200 p-4 md:flex dark:border-zinc-800">
        <Link
          href="/dashboard"
          className="mb-4 px-3 text-lg font-semibold text-emerald-800 dark:text-emerald-400"
        >
          BarakahFi
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map((item) =>
            item.ready ? (
              <Link
                key={item.label}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900',
                  pathname === item.href &&
                    'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                )}
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                aria-disabled="true"
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-400"
              >
                {item.label}
                <span className="rounded bg-zinc-100 px-1.5 text-[10px] tracking-wide uppercase dark:bg-zinc-900">
                  Soon
                </span>
              </span>
            ),
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 px-4 sm:px-6 dark:border-zinc-800">
          <span className="font-semibold text-emerald-800 md:hidden dark:text-emerald-400">
            BarakahFi
          </span>
          <span className="hidden text-sm text-zinc-500 md:inline">{me.data.email}</span>
          <Button variant="outline" onClick={onLogout} loading={logout.isPending} className="h-9">
            Sign out
          </Button>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
