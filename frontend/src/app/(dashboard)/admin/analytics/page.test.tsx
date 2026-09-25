import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Funnel } from '@/features/analytics/queries';

vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({ locale: 'fr', setLocale: vi.fn(), t: (k: string) => k, ta: () => [] }),
}));
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }),
}));

const useFunnel = vi.fn();
vi.mock('@/features/analytics/queries', () => ({ useFunnel: () => useFunnel() }));

import AdminAnalyticsPage from './page';

afterEach(() => useFunnel.mockReset());

const funnel: Funnel = {
  rangeDays: 30,
  steps: [
    { type: 'signup', count: 120 },
    { type: 'email_verified', count: 90 },
    { type: 'subscription_created', count: 12 },
  ],
};

describe('AdminAnalyticsPage (EF-ADM-05)', () => {
  it('shows skeletons while loading', () => {
    useFunnel.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = render(<AdminAnalyticsPage />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders the empty state when the top step is zero', () => {
    useFunnel.mockReturnValue({
      data: { rangeDays: null, steps: [] },
      isLoading: false,
      isError: false,
    });
    render(<AdminAnalyticsPage />);
    expect(screen.getByText('analytics.empty')).toBeInTheDocument();
  });

  it('renders the funnel step counts', () => {
    useFunnel.mockReturnValue({ data: funnel, isLoading: false, isError: false });
    render(<AdminAnalyticsPage />);
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
