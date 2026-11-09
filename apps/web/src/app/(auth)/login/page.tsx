import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Sign in · BarakahFi' };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-6 text-zinc-600 dark:text-zinc-400">Sign in to your account.</p>
      {/* useSearchParams() needs a Suspense boundary so the page can still prerender. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
