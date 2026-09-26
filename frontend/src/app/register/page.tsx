'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Briefcase, Gift } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';

// Isolated so its useSearchParams() sits under its own Suspense boundary,
// keeping the register page statically prerenderable.
function InvitedBanner() {
  const { t } = useLocale();
  const params = useSearchParams();
  if (!params.get('ref')) return null;
  return (
    <div className="mb-6 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
      <Gift className="size-4 shrink-0 text-primary" />
      {t('referral.invited')}
    </div>
  );
}
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function RegisterPage() {
  const { t } = useLocale();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
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

    // ENF-12 — explicit consent is mandatory (the backend enforces it too).
    if (!consent) {
      setError(t('auth.register.consentRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      // referralCode is a real backend field (EF-GROW-02) not yet in the
      // generated schema — `as never` matches the app's convention for
      // sending fields the stale client type doesn't know about. Read from
      // the URL at submit time (no state) to keep the page prerenderable.
      const referralCode = new URLSearchParams(window.location.search).get('ref');
      // Self-registration is candidate-only — recruiter accounts are created by
      // an administrator (the backend enforces this too).
      const body: Record<string, unknown> = {
        email,
        password,
        roles: ['candidate'],
        consentAccepted: consent,
      };
      if (referralCode) body.referralCode = referralCode;
      const { error: apiError } = await apiClient.POST('/api/v1/auth/register', {
        body: body as never,
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

            <Suspense fallback={null}>
              <InvitedBanner />
            </Suspense>

            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="flex flex-col gap-5"
              noValidate
            >
              <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                {t('auth.register.recruiterNote')}
              </p>

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

              <div className="flex items-start gap-2">
                <input
                  id="register-consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
                  aria-describedby="register-consent-label"
                />
                <Label
                  htmlFor="register-consent"
                  id="register-consent-label"
                  className="text-xs font-normal leading-relaxed text-muted-foreground"
                >
                  {t('auth.register.consentLabel')}{' '}
                  <Link
                    href="/privacy"
                    className="text-primary hover:underline underline-offset-4"
                  >
                    {t('auth.register.consentPolicyLink')}
                  </Link>
                </Label>
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {success && (
                <p role="status" className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-foreground">
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
