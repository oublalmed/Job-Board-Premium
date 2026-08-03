'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Briefcase } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function RegisterPage() {
  const { t } = useLocale();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'candidate' | 'recruiter'>('candidate');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validatePassword(pw: string): boolean {
    return (
      pw.length >= 10 &&
      /[A-Z]/.test(pw) &&
      /[a-z]/.test(pw) &&
      /\d/.test(pw) &&
      /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validatePassword(password)) {
      setError(t('auth.register.passwordHint'));
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: apiError } = await apiClient.POST('/api/v1/auth/register', {
        body: { email, password, roles: [role] },
      });
      if (apiError) {
        setError(t('auth.register.error'));
        return;
      }
      setSuccess(t('auth.register.success'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh">
      <div className="relative hidden w-1/2 bg-primary lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary/80" />
        <div className="relative z-10 flex flex-col items-center gap-6 px-12 text-center text-primary-foreground">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <Briefcase className="size-8" />
          </div>
          <h1 className="text-4xl font-bold">{t('app.name')}</h1>
          <p className="max-w-md text-lg text-primary-foreground/80">
            {t('app.description')}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between p-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-foreground lg:hidden">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
              T
            </div>
            {t('app.name')}
          </Link>
          <div className="ms-auto">
            <LanguageSwitcher />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground">
                {t('auth.register.title')}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('auth.register.subtitle')}
              </p>
            </div>

            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="flex flex-col gap-5"
              noValidate
            >
              <div className="flex flex-col gap-2">
                <Label>{t('auth.register.roleLabel')}</Label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('candidate')}
                    className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                      role === 'candidate'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {t('auth.register.roleCandidate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('recruiter')}
                    className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                      role === 'recruiter'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {t('auth.register.roleRecruiter')}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="register-email">{t('auth.emailLabel')}</Label>
                <Input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="register-password">{t('auth.passwordLabel')}</Label>
                <Input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby="register-password-hint"
                />
                <p id="register-password-hint" className="text-xs text-muted-foreground">
                  {t('auth.register.passwordHint')}
                </p>
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {success && (
                <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                  {success}
                </p>
              )}

              <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
                {isSubmitting ? t('auth.register.submitting') : t('auth.register.submit')}
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              {t('auth.register.hasAccount')}{' '}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline underline-offset-4"
              >
                {t('auth.register.loginLink')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
