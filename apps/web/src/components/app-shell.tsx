'use client';

import {
  ArrowLeftRight,
  BarChart3,
  Ellipsis,
  HandCoins,
  LayoutDashboard,
  LineChart,
  PiggyBank,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { RealtimeProvider } from '@/components/realtime-provider';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { useLogout, useMe } from '@/hooks/use-auth';
import { ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/cn';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  ready: boolean;
  /** Shown in the phone's bottom bar; the rest live under "More". */
  primary?: boolean;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, ready: true, primary: true },
  {
    href: '/transactions',
    label: 'Transactions',
    icon: ArrowLeftRight,
    ready: true,
    primary: true,
  },
  { href: '/portfolio', label: 'Portfolio', icon: LineChart, ready: true, primary: true },
  { href: '/screener', label: 'Halal screener', icon: ShieldCheck, ready: true, primary: true },
  { href: '/zakat', label: 'Zakat', icon: HandCoins, ready: true, primary: true },
  { href: '/budgets', label: 'Budgets', icon: PiggyBank, ready: true },
  { href: '#', label: 'Reports', icon: BarChart3, ready: false },
  { href: '#', label: 'Settings', icon: Settings, ready: false },
];

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  if (!item.ready) {
    return (
      <span
        aria-disabled="true"
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400"
      >
        <Icon className="size-4" aria-hidden />
        <span className="flex-1">{item.label}</span>
        <span className="rounded bg-zinc-100 px-1.5 text-[10px] tracking-wide uppercase dark:bg-zinc-900">
          Soon
        </span>
      </span>
    );
  }
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900',
        active && 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
      )}
    >
      <Icon className="size-4" aria-hidden />
      {item.label}
    </Link>
  );
}

/** Phones: five main sections in a thumb-reach bar, everything else behind "More". */
function BottomNav({ pathname }: { pathname: string }) {
  const [more, setMore] = useState(false);
  const primary = NAV.filter((n) => n.primary);
  const secondary = NAV.filter((n) => !n.primary);
  const secondaryActive = secondary.some((n) => n.ready && isActive(pathname, n.href));

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-background pb-[env(safe-area-inset-bottom)] md:hidden dark:border-zinc-800"
      >
        <ul className="grid grid-cols-6">
          {primary.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]',
                    active
                      ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                      : 'text-zinc-500',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {item.label === 'Halal screener'
                    ? 'Screener'
                    : item.label === 'Transactions'
                      ? 'Money'
                      : item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMore(true)}
              className={cn(
                'flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px]',
                secondaryActive
                  ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                  : 'text-zinc-500',
              )}
            >
              <Ellipsis className="size-5" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>
      <Sheet open={more} onClose={() => setMore(false)} title="More">
        <ul className="flex flex-col gap-1" onClick={() => setMore(false)}>
          {secondary.map((item) => (
            <li key={item.label}>
              <SidebarLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

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
    <RealtimeProvider>
      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-zinc-200 p-4 md:flex dark:border-zinc-800">
          <Link
            href="/dashboard"
            className="mb-4 px-3 text-lg font-semibold text-emerald-800 dark:text-emerald-400"
          >
            BarakahFi
          </Link>
          <nav aria-label="Main" className="flex flex-col gap-1">
            {NAV.map((item) => (
              <SidebarLink key={item.label} item={item} pathname={pathname} />
            ))}
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
          {/* Extra bottom padding on phones so the tab bar never covers the end of a page. */}
          <main className="flex-1 p-4 pb-24 sm:p-6 md:pb-6">{children}</main>
        </div>
      </div>
      <BottomNav pathname={pathname} />
    </RealtimeProvider>
  );
}
