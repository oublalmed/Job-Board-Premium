import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ContactQuotaStatus } from './queries';

vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({
    locale: 'fr',
    setLocale: vi.fn(),
    t: (key: string) => key,
    ta: () => [],
  }),
}));

const useContactQuota = vi.fn();
vi.mock('./queries', () => ({ useContactQuota: () => useContactQuota() }));

import { SubscriptionStatusCard } from './SubscriptionStatusCard';

function quota(over: Partial<ContactQuotaStatus> = {}): ContactQuotaStatus {
  return {
    active: true,
    plan: 'growth',
    status: 'active',
    contactQuota: 60,
    contactsUsed: 12,
    contactsRemaining: 48,
    quotaResetAt: null,
    endsAt: '2026-12-31T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    pastDueSince: null,
    ...over,
  };
}

afterEach(() => useContactQuota.mockReset());

describe('SubscriptionStatusCard (EF-BILL-02 / EF-BILL-05)', () => {
  it('shows a no-active-plan message when there is no subscription', () => {
    useContactQuota.mockReturnValue({
      data: quota({ active: false }),
      isLoading: false,
    });
    render(<SubscriptionStatusCard />);
    expect(screen.getByText('subscription.noActivePlan')).toBeInTheDocument();
  });

  it('surfaces plan, status, renewal date and remaining contacts when active', () => {
    useContactQuota.mockReturnValue({ data: quota(), isLoading: false });
    render(<SubscriptionStatusCard />);

    expect(screen.getByText('growth')).toBeInTheDocument();
    expect(screen.getByText('subscription.status_active')).toBeInTheDocument();
    expect(screen.getByText('subscription.renewsOn')).toBeInTheDocument();
    // 48 / 60 remaining
    expect(screen.getByText(/48/)).toBeInTheDocument();
    // healthy → no dunning alert
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('raises a dunning alert when the subscription is past due (EF-BILL-05)', () => {
    useContactQuota.mockReturnValue({
      data: quota({ status: 'past_due', pastDueSince: '2026-11-01T00:00:00.000Z' }),
      isLoading: false,
    });
    render(<SubscriptionStatusCard />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('subscription.dunningTitle')).toBeInTheDocument();
    expect(screen.getByText('subscription.status_past_due')).toBeInTheDocument();
  });

  it('shows the ends-on label and cancellation note when a cancel is scheduled', () => {
    useContactQuota.mockReturnValue({
      data: quota({ cancelAtPeriodEnd: true }),
      isLoading: false,
    });
    render(<SubscriptionStatusCard />);
    expect(screen.getByText('subscription.endsOn')).toBeInTheDocument();
    expect(screen.getByText('subscription.cancelScheduled')).toBeInTheDocument();
    expect(screen.queryByText('subscription.renewsOn')).not.toBeInTheDocument();
  });
});
