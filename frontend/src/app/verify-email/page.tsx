'use client';

import { Suspense, useState, useEffect, useRef, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2, MailCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

function VerifyEmailContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    token ? 'loading' : 'error',
  );

  // Resend flow (shown on the error state): a lost/expired link is not a dead
  // end. Always resolves to a generic "sent" confirmation (anti-enumeration).
  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>(
    'idle',
  );

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResendStatus('sending');
    try {
      // Plain fetch (like forgot-password): the response is deliberately
      // generic, so there is nothing typed to consume.
      await fetch(`${BASE}/api/v1/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });
    } catch {
      // Swallowed on purpose: the confirmation is identical either way.
    }
    setResendStatus('sent');
  }

  // The verification token is single-use: the first POST consumes it. React
  // StrictMode (and any remount) runs effects twice in dev, which would fire a
  // second POST against the now-spent token and flip a real success to a false
  // "failed". This ref makes the request fire exactly once per token.
  const verifyStarted = useRef(false);

  useEffect(() => {
    if (!token || verifyStarted.current) return;
    verifyStarted.current = true;
    void (async () => {
      const { error } = await apiClient.POST('/api/v1/auth/verify-email', {
        body: { token },
      });
      setStatus(error ? 'error' : 'success');
    })();
  }, [token]);

  return (
    <motion.div className="w-full max-w-sm text-center" {...fadeUp}>
      {status === 'loading' && (
        <>
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">{t('verifyEmail.verifying')}</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="size-8 text-success" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{t('verifyEmail.success')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('verifyEmail.successDescription')}
          </p>
          <Link href="/login" className="mt-6 inline-block">
            <Button>{t('nav.login')}</Button>
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="size-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{t('verifyEmail.error')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('verifyEmail.errorDescription')}
          </p>

          {resendStatus === 'sent' ? (
            <div className="mt-6 flex items-start gap-2 rounded-lg bg-success/10 p-3 text-start text-sm text-foreground">
              <MailCheck className="mt-0.5 size-4 shrink-0 text-success" />
              <span>{t('verifyEmail.resendSent')}</span>
            </div>
          ) : (
            <form onSubmit={(e) => void handleResend(e)} className="mt-6 flex flex-col gap-3">
              <Input
                type="email"
                required
                autoComplete="email"
                className="h-11"
                placeholder={t('verifyEmail.emailPlaceholder')}
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
              />
              <Button type="submit" disabled={resendStatus === 'sending'}>
                {resendStatus === 'sending'
                  ? t('verifyEmail.resendSending')
                  : t('verifyEmail.resendCta')}
              </Button>
            </form>
          )}

          <Link href="/register" className="mt-4 inline-block">
            <Button variant="ghost" size="sm">
              {t('nav.register')}
            </Button>
          </Link>
        </>
      )}
    </motion.div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
      </div>
      <Suspense
        fallback={
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 size-10 animate-spin text-primary" />
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
