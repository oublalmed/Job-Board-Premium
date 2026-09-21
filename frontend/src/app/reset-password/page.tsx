'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Briefcase, CheckCircle2 } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// EF-CAND-01 — set a new password from the emailed token.
function ResetPasswordForm() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError(t('auth.reset.missingToken'));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        setError(
          res.status === 400
            ? t('auth.reset.invalidToken')
            : t('auth.reset.error'),
        );
        return;
      }
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch {
      setError(t('auth.reset.error'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <CheckCircle2 className="size-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          {t('auth.reset.successTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('auth.reset.success')}
        </p>
        <Link
          href="/login"
          className="mt-2 text-sm font-medium text-primary hover:underline underline-offset-4"
        >
          {t('auth.forgot.backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">
          {t('auth.reset.title')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('auth.reset.subtitle')}
        </p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex flex-col gap-5"
        noValidate
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="reset-password">
            {t('auth.reset.newPasswordLabel')}
          </Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t('auth.register.passwordHint')}
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          size="lg"
          className="w-full"
        >
          {isSubmitting
            ? t('auth.reset.submitting')
            : t('auth.reset.submit')}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-primary hover:underline underline-offset-4"
        >
          {t('auth.forgot.backToLogin')}
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  const { t } = useLocale();
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex items-center justify-between p-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Briefcase className="size-4" />
          </div>
          {t('app.name')}
        </Link>
        <LanguageSwitcher />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 pb-12">
        <div className="w-full max-w-sm">
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
