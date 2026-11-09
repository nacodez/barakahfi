import type { Metadata } from 'next';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = { title: 'Create account · BarakahFi' };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mb-6 text-zinc-600 dark:text-zinc-400">Start tracking your halal wealth.</p>
      <RegisterForm />
    </>
  );
}
