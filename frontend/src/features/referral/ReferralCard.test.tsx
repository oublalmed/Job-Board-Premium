import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({ locale: 'fr', setLocale: vi.fn(), t: (k: string) => k, ta: () => [] }),
}));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const useReferral = vi.fn();
vi.mock('./queries', () => ({ useReferral: () => useReferral() }));

import { ReferralCard } from './ReferralCard';

afterEach(() => useReferral.mockReset());

describe('ReferralCard (EF-GROW-02)', () => {
  it('shows a skeleton while loading', () => {
    useReferral.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<ReferralCard />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders the referral link and conversion stats', () => {
    useReferral.mockReturnValue({
      data: { code: 'REF-7', signups: 5, conversions: 2 },
      isLoading: false,
    });
    render(<ReferralCard />);
    expect(screen.getByText('5')).toBeInTheDocument(); // signups
    expect(screen.getByText('2')).toBeInTheDocument(); // conversions
    expect(screen.getByDisplayValue(/register\?ref=REF-7$/)).toBeInTheDocument();
  });
});
