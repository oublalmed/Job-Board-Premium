'use client';

import { useState, type FormEvent } from 'react';
import { Shield, ShieldCheck, KeyRound, Loader2, Copy, Check } from 'lucide-react';
import { useLocale } from '@/i18n/locale-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useMfaStatus,
  useChangePassword,
  useMfaSetup,
  useMfaEnable,
  useMfaDisable,
} from './security';

function ChangePasswordSection() {
  const { t } = useLocale();
  const { toast } = useToast();
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          toast(t('settings.security.changePassword.success'), 'success');
          setCurrent('');
          setNext('');
        },
        onError: () =>
          toast(t('settings.security.changePassword.error'), 'error'),
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <KeyRound className="size-4 text-primary" />
        {t('settings.security.changePassword.title')}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cur-pw">
            {t('settings.security.changePassword.current')}
          </Label>
          <Input
            id="cur-pw"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-pw">
            {t('settings.security.changePassword.new')}
          </Label>
          <Input
            id="new-pw"
            type="password"
            autoComplete="new-password"
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('auth.register.passwordHint')}
      </p>
      <Button
        type="submit"
        size="sm"
        className="self-start"
        disabled={change.isPending || !current || !next}
      >
        {change.isPending && <Loader2 className="size-4 animate-spin" />}
        {t('settings.security.changePassword.submit')}
      </Button>
    </form>
  );
}

function MfaSection() {
  const { t } = useLocale();
  const { toast } = useToast();
  const { data, isLoading } = useMfaStatus();
  const setup = useMfaSetup();
  const enable = useMfaEnable();
  const disable = useMfaDisable();

  const [provisioning, setProvisioning] = useState<{
    secret: string;
    otpauthUri: string;
  } | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [copied, setCopied] = useState(false);

  const enabled = data?.mfaEnabled ?? false;

  function startSetup() {
    setup.mutate(undefined, {
      onSuccess: (res) => setProvisioning(res),
      onError: () => toast(t('common.error'), 'error'),
    });
  }

  function confirmEnable(e: FormEvent) {
    e.preventDefault();
    enable.mutate(
      { code },
      {
        onSuccess: (res) => {
          setBackupCodes(res.backupCodes);
          setProvisioning(null);
          setCode('');
          toast(t('settings.security.mfa.enabled'), 'success');
        },
        onError: () => toast(t('settings.security.mfa.invalidCode'), 'error'),
      },
    );
  }

  function confirmDisable(e: FormEvent) {
    e.preventDefault();
    disable.mutate(
      { code: disableCode },
      {
        onSuccess: () => {
          setDisabling(false);
          setDisableCode('');
          setBackupCodes(null);
          toast(t('settings.security.mfa.disabled'), 'success');
        },
        onError: () => toast(t('settings.security.mfa.invalidCode'), 'error'),
      },
    );
  }

  function copySecret() {
    if (!provisioning) return;
    void navigator.clipboard?.writeText(provisioning.secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex flex-col gap-4 border-t border-border/60 pt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {enabled ? (
            <ShieldCheck className="size-4 text-primary" />
          ) : (
            <Shield className="size-4 text-muted-foreground" />
          )}
          {t('settings.security.mfa.title')}
        </div>
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
            enabled
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {enabled
            ? t('settings.security.mfa.statusOn')
            : t('settings.security.mfa.statusOff')}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('settings.security.mfa.description')}
      </p>

      {isLoading ? null : backupCodes ? (
        <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-4">
          <p className="text-sm font-medium text-foreground">
            {t('settings.security.mfa.backupTitle')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('settings.security.mfa.backupHint')}
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-sm">
            {backupCodes.map((c) => (
              <li key={c} className="rounded bg-muted px-2 py-1">
                {c}
              </li>
            ))}
          </ul>
        </div>
      ) : enabled ? (
        disabling ? (
          <form onSubmit={confirmDisable} className="flex flex-col gap-2 sm:max-w-xs">
            <Label htmlFor="mfa-disable-code">
              {t('settings.security.mfa.codeLabel')}
            </Label>
            <div className="flex gap-2">
              <Input
                id="mfa-disable-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                required
              />
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={disable.isPending}
              >
                {disable.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {t('settings.security.mfa.disable')}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setDisabling(true)}
          >
            {t('settings.security.mfa.disable')}
          </Button>
        )
      ) : provisioning ? (
        <form onSubmit={confirmEnable} className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            {t('settings.security.mfa.scanHint')}
          </p>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">
              {t('settings.security.mfa.secretLabel')}
            </Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 font-mono text-sm">
                {provisioning.secret}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={copySecret}
                aria-label={t('settings.security.mfa.secretLabel')}
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1 sm:max-w-xs">
            <Label htmlFor="mfa-code" className="text-xs">
              {t('settings.security.mfa.codeLabel')}
            </Label>
            <div className="flex gap-2">
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
              <Button type="submit" size="sm" disabled={enable.isPending}>
                {enable.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {t('settings.security.mfa.confirm')}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <Button
          size="sm"
          className="self-start gap-2"
          onClick={startSetup}
          disabled={setup.isPending}
        >
          {setup.isPending && <Loader2 className="size-4 animate-spin" />}
          {t('settings.security.mfa.enable')}
        </Button>
      )}
    </div>
  );
}

// EF-CAND-01 / ENF-06 — self-service security: change password + manage 2FA.
export function SecurityCard() {
  const { t } = useLocale();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5 text-primary" />
          {t('settings.security.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ChangePasswordSection />
        <MfaSection />
      </CardContent>
    </Card>
  );
}
