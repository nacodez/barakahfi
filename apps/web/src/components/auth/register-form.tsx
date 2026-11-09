'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@barakahfi/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { useRegister } from '@/hooks/use-auth';
import { ApiRequestError } from '@/lib/api';

export function RegisterForm() {
  // react-hook-form keeps field refs in a mutable store; the React Compiler would memoise
  // register() and break re-registration after reset(), so this component opts out.
  'use no memo';
  const router = useRouter();
  const registerUser = useRegister();
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      await registerUser.mutateAsync(values);
      router.replace('/dashboard');
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 409) {
        setError('email', { message: 'An account with this email already exists.' });
      } else if (e instanceof ApiRequestError && e.status === 429) {
        setFormError('Too many attempts. Please wait a minute and try again.');
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError>{formError}</FormError>
      <Field label="Name" autoComplete="name" error={errors.name?.message} {...register('name')} />
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
        autoComplete="new-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <p className="-mt-2 text-xs text-zinc-500">
        At least 8 characters, with an uppercase letter and a number.
      </p>
      <Button type="submit" loading={registerUser.isPending}>
        Create account
      </Button>
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already registered?{' '}
        <Link
          href="/login"
          className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
