import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AdminOverview, Funnel } from '@/features/analytics/queries';

vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({ locale: 'fr', setLocale: vi.fn(), t: (k: string) => k, ta: () => [] }),
}));
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }),
}));

const useFunnel = vi.fn();
const useAdminOverview = vi.fn();
vi.mock('@/features/analytics/queries', () => ({
  useFunnel: () => useFunnel(),
  useAdminOverview: () => useAdminOverview(),
}));

import AdminAnalyticsPage from './page';

const overview: AdminOverview = {
  users: { total: 100, candidates: 70, recruiters: 25 },
  companies: { total: 20 },
  subscriptions: {
    active: 12,
    byPlan: { starter: 5, growth: 3, scale: 2, enterprise: 2 },
  },
  jobs: { total: 30, published: 18 },
  applications: { total: 210 },
  assessments: { total: 80, completed: 55 },
};

// The §5 platform overview loads independently; give it a stable loaded state
// so these funnel-focused tests aren't affected by it.
beforeEach(() =>
  useAdminOverview.mockReturnValue({
    data: overview,
    isLoading: false,
    isError: false,
  }),
);

afterEach(() => {
  useFunnel.mockReset();
  useAdminOverview.mockReset();
});

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
