import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid flex-1 lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-emerald-900 p-12 text-emerald-50 lg:flex">
        <Link href="/" className="text-lg font-semibold tracking-wide">
          BarakahFi
        </Link>
        <div className="flex flex-col gap-4">
          <p className="text-3xl leading-snug font-semibold">
            Know your wealth is clean, and your zakat is right.
          </p>
          <p className="max-w-md text-emerald-200">
            Screen stocks against AAOIFI standards, track your portfolio, and calculate zakat with
            confidence.
          </p>
        </div>
        <p className="text-sm text-emerald-300">Sharia-compliant personal finance</p>
      </aside>
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
