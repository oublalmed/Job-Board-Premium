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

// next/link renders a plain anchor in the test DOM.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The quota query is the single data dependency; each test sets its return.
const useContactQuota = vi.fn();
vi.mock('./queries', () => ({
  useContactQuota: () => useContactQuota(),
}));

import { RecruiterAccessBar } from './RecruiterAccessBar';

type QuotaState = {
  data?: ContactQuotaStatus;
  isLoading: boolean;
  isError: boolean;
};

function setQuota(state: QuotaState) {
  useContactQuota.mockReturnValue(state);
}

afterEach(() => {
  useContactQuota.mockReset();
});

describe('RecruiterAccessBar', () => {
  it('renders the restricted/quota-blocked state when the subscription is inactive', () => {
    setQuota({
      isLoading: false,
      isError: false,
      data: {
        active: false,
        plan: null,
        status: 'inactive',
        contactQuota: null,
        contactsUsed: null,
        contactsRemaining: null,
        quotaResetAt: null,
        endsAt: null,
        cancelAtPeriodEnd: false,
        pastDueSince: null,
      },
    });

    render(<RecruiterAccessBar />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('billing.restrictedTitle')).toBeInTheDocument();
    expect(
      screen.getByText('billing.restrictedDescription'),
    ).toBeInTheDocument();

    // Recruiters no longer self-serve a plan — the bar points them to their
    // administrator instead of linking to a checkout page.
    expect(
      screen.getByText('billing.restrictedAdminHint'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('surfaces the remaining contact quota when active', () => {
    setQuota({
      isLoading: false,
      isError: false,
      data: {
        active: true,
        plan: 'pro',
        status: 'active',
        contactQuota: 100,
        contactsUsed: 58,
        contactsRemaining: 42,
        quotaResetAt: null,
        endsAt: null,
        cancelAtPeriodEnd: false,
        pastDueSince: null,
      },
    });

    const { container } = render(<RecruiterAccessBar />);

    // No alert in the healthy state, but the remaining count is shown. The
    // count sits in a span mixed with i18n keys, so read the combined text.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const counter = container.querySelector('.tabular-nums');
    expect(counter?.textContent).toMatch(/42/);
    expect(counter?.textContent).toMatch(/billing\.contactsOf/);
    expect(counter?.textContent).toMatch(/100/);
    // 42 of 100 is well above the low-water mark, so no warning label.
    expect(screen.queryByText('billing.quotaLow')).not.toBeInTheDocument();
    expect(
      screen.queryByText('billing.quotaExhausted'),
    ).not.toBeInTheDocument();
  });

  it('warns when the remaining quota is exhausted', () => {
    setQuota({
      isLoading: false,
      isError: false,
      data: {
        active: true,
        plan: 'pro',
        status: 'active',
        contactQuota: 100,
        contactsUsed: 100,
        contactsRemaining: 0,
        quotaResetAt: null,
        endsAt: null,
        cancelAtPeriodEnd: false,
        pastDueSince: null,
      },
    });

    render(<RecruiterAccessBar />);
    expect(screen.getByText('billing.quotaExhausted')).toBeInTheDocument();
  });

  it('renders nothing while loading or on error', () => {
    setQuota({ isLoading: true, isError: false });
    const { container: loading } = render(<RecruiterAccessBar />);
    expect(loading).toBeEmptyDOMElement();

    setQuota({ isLoading: false, isError: true });
    const { container: errored } = render(<RecruiterAccessBar />);
    expect(errored).toBeEmptyDOMElement();
  });
});
