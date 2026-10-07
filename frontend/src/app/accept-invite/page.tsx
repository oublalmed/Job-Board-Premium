'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface InviteDetails {
  email: string;
  companyName: string;
  position: string | null;
}

function validatePassword(pw: string): boolean {
  return (
    pw.length >= 10 &&
    /[A-Z]/.test(pw) &&
    /[a-z]/.test(pw) &&
    /\d/.test(pw) &&
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)
  );
}

function AcceptInviteContent() {
  const { t } = useLocale();
  const router = useRouter();
  const token = useSearchParams().get('token');

  const [state, setState] = useState<'loading' | 'ready' | 'invalid' | 'done'>(
    token ? 'loading' : 'invalid',
  );
  const [details, setDetails] = useState<InviteDetails | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void (async () => {
      try {
        const res = await fetch(
          `${BASE}/api/v1/recruiter-invitations/${token}`,
        );
        if (!res.ok) {
          if (active) setState('invalid');
          return;
        }
        const data = (await res.json()) as InviteDetails;
        if (active) {
          setDetails(data);
          setState('ready');
        }
      } catch {
        if (active) setState('invalid');
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!validatePassword(password)) {
      setError(t('auth.register.passwordHint'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/v1/recruiter-invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setError(body.message ?? t('common.error'));
        return;
      }
      setState('done');
      setTimeout(() => router.push('/login'), 2500);
    } finally {
      setSubmitting(false);
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="size-8 text-destructive" />
        </div>
        <h1 className="text-xl font-bold text-foreground">
          {t('acceptInvite.invalidTitle')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('acceptInvite.invalidBody')}
        </p>
        <Link href="/login" className="mt-6 inline-block">
          <Button variant="outline">{t('nav.login')}</Button>
        </Link>
      </div>
    );
  }

  if (state === 'done') {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="size-8 text-success" />
        </div>
        <h1 className="text-xl font-bold text-foreground">
          {t('acceptInvite.doneTitle')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('acceptInvite.doneBody')}
        </p>
        <Link href="/login" className="mt-6 inline-block">
          <Button>{t('nav.login')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Building2 className="size-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t('acceptInvite.title', { company: details?.companyName ?? '' })}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('acceptInvite.subtitle')} <strong>{details?.email}</strong>
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-password">{t('auth.passwordLabel')}</Label>
          <Input
            id="invite-password"
            type="password"
            autoComplete="new-password"
            required
            className="h-12"
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

        <Button type="submit" size="lg" disabled={submitting} className="h-12 w-full">
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          {t('acceptInvite.cta')}
        </Button>
      </form>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-6">
      <div className="absolute inset-x-0 top-0 flex justify-end p-6">
        <LanguageSwitcher />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />
      <Suspense fallback={<Loader2 className="size-8 animate-spin text-primary" />}>
        <AcceptInviteContent />
      </Suspense>
    </div>
  );
}
