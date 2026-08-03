'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useLocale } from '@/i18n/locale-context';
import { Button } from '@/components/ui/button';

function VerifyEmailContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    token ? 'loading' : 'error',
  );

  useEffect(() => {
    if (!token) return;
    void verify(token);
  }, [token]);

  async function verify(verificationToken: string) {
    const { error } = await apiClient.POST('/api/v1/auth/verify-email', {
      body: { token: verificationToken },
    });
    setStatus(error ? 'error' : 'success');
  }

  return (
    <div className="w-full max-w-sm text-center">
      {status === 'loading' && (
        <>
          <Loader2 className="mx-auto mb-4 size-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('verifyEmail.verifying')}</p>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle2 className="mx-auto mb-4 size-10 text-emerald-500" />
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
          <XCircle className="mx-auto mb-4 size-10 text-destructive" />
          <h1 className="text-xl font-bold text-foreground">{t('verifyEmail.error')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('verifyEmail.errorDescription')}
          </p>
          <Link href="/register" className="mt-6 inline-block">
            <Button variant="outline">{t('nav.register')}</Button>
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
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
