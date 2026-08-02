import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Deliberately minimal: email + password only, no role selection. Which
// persona (candidate/recruiter) a new account becomes, and any onboarding
// beyond that, is a real business flow — out of scope for Front 0 ("ne
// construis aucun parcours métier"). The backend already defaults roles
// when omitted (RegisterDto.roles is optional).
export function RegisterPage() {
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const { error: apiError } = await apiClient.POST(
        '/api/v1/auth/register',
        {
          body: { email, password },
        },
      );
      if (apiError) {
        setError(t('auth.register.error'));
        return;
      }
      setSuccessMessage(t('auth.register.success'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('auth.register.title')}</CardTitle>
          <CardDescription>{t('auth.register.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="flex flex-col gap-4"
            noValidate
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="register-email">{t('auth.emailLabel')}</Label>
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                required
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="register-password">
                {t('auth.passwordLabel')}
              </Label>
              <Input
                id="register-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby="register-password-hint"
              />
              <p
                id="register-password-hint"
                className="text-xs text-muted-foreground"
              >
                {t('auth.register.passwordHint')}
              </p>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {successMessage && (
              <p role="status" className="text-sm text-foreground">
                {successMessage}
              </p>
            )}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting
                ? t('auth.register.submitting')
                : t('auth.register.submit')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
          <span>{t('auth.register.hasAccount')}</span>
          <Link
            to="/login"
            className="text-primary underline-offset-4 hover:underline"
          >
            {t('auth.register.loginLink')}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
