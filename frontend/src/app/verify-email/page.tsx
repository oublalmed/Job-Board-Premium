'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { Button } from '@/components/ui/button';

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

  useEffect(() => {
    if (!token) return;
    let active = true;
    void (async () => {
      const { error } = await apiClient.POST('/api/v1/auth/verify-email', {
        body: { token },
      });
      if (active) setStatus(error ? 'error' : 'success');
    })();
    return () => {
      active = false;
    };
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
          <Link href="/register" className="mt-6 inline-block">
            <Button variant="outline">{t('nav.register')}</Button>
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
