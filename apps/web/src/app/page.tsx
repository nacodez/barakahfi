import Link from 'next/link';

const features = [
  {
    title: 'Halal stock screener',
    body: 'AAOIFI debt, cash and revenue screens with purification amounts.',
  },
  {
    title: 'Zakat calculator',
    body: 'Nisab-aware, step by step, with a saved history for every hawl.',
  },
  {
    title: 'Portfolio tracking',
    body: 'Holdings, gain/loss and a compliance badge on every position.',
  },
  { title: 'Budgets and cash flow', body: 'Category budgets, reports and net worth in one place.' },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-12 px-6 py-20">
      <header className="flex flex-col gap-5">
        <p className="text-sm font-medium tracking-widest text-emerald-700 uppercase dark:text-emerald-400">
          BarakahFi
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Personal finance that respects your faith.
        </h1>
        <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          Track investments, screen stocks for Sharia compliance, calculate zakat and manage
          budgets, all in one place.
        </p>
        <div className="flex gap-3">
          <Link
            href="/register"
            className="rounded-full bg-emerald-700 px-5 py-2.5 font-medium text-white transition-colors hover:bg-emerald-800"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-zinc-300 px-5 py-2.5 font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <article
            key={f.title}
            className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
          >
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">{f.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
