'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/auth/auth-context';
import { useLocale } from '@/i18n/locale-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Logo } from '@/components/Logo';
import { CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const { t } = useLocale();
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch {
      setError(t('auth.login.error'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh">
      {/* Left panel - branding (light, so the transparent logo reads cleanly) */}
      <div className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden border-e border-border/40 bg-gradient-to-br from-primary/5 via-background to-background lg:flex">
        {/* soft brand accents echoing the logo's blue→violet */}
        <div className="pointer-events-none absolute -start-24 -top-24 size-[26rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -end-24 size-[26rem] rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative z-10 flex max-w-md flex-col items-center gap-9 px-14 text-center">
          <Logo className="h-16 w-auto" priority />
          <p className="text-lg leading-relaxed text-muted-foreground">
            {t('app.tagline')}
          </p>
          <ul className="flex flex-col gap-3 text-start">
            {[t('auth.benefits.b1'), t('auth.benefits.b2'), t('auth.benefits.b3')].map(
              (b) => (
                <li key={b} className="flex items-center gap-3 text-sm text-foreground/75">
                  <CheckCircle2 className="size-5 shrink-0 text-primary" />
                  <span>{b}</span>
                </li>
              ),
            )}
          </ul>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between p-6">
          <Link
            href="/"
            className="flex items-center lg:hidden"
            aria-label={t('app.name')}
          >
            <Logo className="h-9 w-auto" />
          </Link>
          <div className="ms-auto">
            <LanguageSwitcher />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground">
                {t('auth.login.title')}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('auth.login.subtitle')}
              </p>
            </div>

            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="flex flex-col gap-5"
              noValidate
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-email">{t('auth.emailLabel')}</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">
                    {t('auth.passwordLabel')}
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline underline-offset-4"
                  >
                    {t('auth.login.forgotLink')}
                  </Link>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
                {isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')}
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              {t('auth.login.noAccount')}{' '}
              <Link
                href="/register"
                className="font-medium text-primary hover:underline underline-offset-4"
              >
                {t('auth.login.registerLink')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
