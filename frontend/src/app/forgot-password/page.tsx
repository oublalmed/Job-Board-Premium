'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Briefcase, MailCheck } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// EF-CAND-01 — request a password-reset link. The API always responds the same
// way (no user enumeration), so the UI always shows the same confirmation.
export default function ForgotPasswordPage() {
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await fetch(`${BASE}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Deliberately swallowed: the confirmation is identical either way.
    } finally {
      // Always show the same confirmation, success or not.
      setSent(true);
      setIsSubmitting(false);
    }
  }

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
          {sent ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <MailCheck className="size-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                {t('auth.forgot.sentTitle')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('auth.forgot.sent')}
              </p>
              <Link
                href="/login"
                className="mt-2 text-sm font-medium text-primary hover:underline underline-offset-4"
              >
                {t('auth.forgot.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground">
                  {t('auth.forgot.title')}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('auth.forgot.subtitle')}
                </p>
              </div>

              <form
                onSubmit={(e) => void handleSubmit(e)}
                className="flex flex-col gap-5"
                noValidate
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="forgot-email">{t('auth.emailLabel')}</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder={t('auth.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="lg"
                  className="w-full"
                >
                  {isSubmitting
                    ? t('auth.forgot.submitting')
                    : t('auth.forgot.submit')}
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
          )}
        </div>
      </div>
    </div>
  );
}
