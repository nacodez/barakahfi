'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@barakahfi/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { useLogin } from '@/hooks/use-auth';
import { ApiRequestError } from '@/lib/api';
import { safeNext } from '@/lib/redirect';

function describe(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) return 'Invalid email or password.';
    if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  }
  return 'Something went wrong. Please try again.';
}

export function LoginForm() {
  // react-hook-form keeps field refs in a mutable store; the React Compiler would memoise
  // register() and break re-registration after reset(), so this component opts out.
  'use no memo';
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const login = useLogin();
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      await login.mutateAsync(values);
      router.replace(next);
    } catch (e) {
      setFormError(describe(e));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError>{formError}</FormError>
      <Field
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
      <Field
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <Button type="submit" loading={login.isPending}>
        Sign in
      </Button>
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        New to BarakahFi?{' '}
        <Link
          href="/register"
          className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
