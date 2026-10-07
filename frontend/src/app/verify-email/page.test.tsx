import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// t() echoes the key, so assertions read the i18n keys directly.
vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({ locale: 'fr', setLocale: vi.fn(), t: (k: string) => k, ta: () => [] }),
}));
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    { get: () => ({ children }: { children?: React.ReactNode }) => <div>{children}</div> },
  ),
}));
vi.mock('next/link', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
}));

const token = 'tok-123';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(`token=${token}`),
}));

const post = vi.fn();
vi.mock('@/api/client', () => ({ apiClient: { POST: (...args: unknown[]) => post(...args) } }));

import VerifyEmailPage from './page';

afterEach(() => {
  post.mockReset();
});

describe('VerifyEmailPage', () => {
  it('verifies the token exactly once under StrictMode (single-use token not double-spent)', async () => {
    post.mockResolvedValue({ error: undefined });

    render(
      <StrictMode>
        <VerifyEmailPage />
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByText('verifyEmail.success')).toBeInTheDocument());
    // The crux: even though StrictMode runs the effect twice, the single-use
    // token must be POSTed only once — a second call would 400 and flip the
    // real success to a false failure.
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('shows the error state (with resend form) when the token is rejected', async () => {
    post.mockResolvedValue({ error: { statusCode: 400 } });

    render(
      <StrictMode>
        <VerifyEmailPage />
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByText('verifyEmail.error')).toBeInTheDocument());
    expect(screen.getByText('verifyEmail.resendCta')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });
});
