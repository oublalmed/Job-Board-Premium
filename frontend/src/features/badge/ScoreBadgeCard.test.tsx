import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({ locale: 'fr', setLocale: vi.fn(), t: (k: string) => k, ta: () => [] }),
}));
const toast = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast }) }));
// ScoreShowcase renders the badge visual; stub it to isolate the card logic.
vi.mock('./ScoreShowcase', () => ({ ScoreShowcase: () => <div data-testid="showcase" /> }));

const useScoreBadge = vi.fn();
const enableMutate = vi.fn();
const disableMutate = vi.fn();
vi.mock('./queries', () => ({
  useScoreBadge: () => useScoreBadge(),
  useEnableBadge: () => ({ mutate: enableMutate, isPending: false }),
  useDisableBadge: () => ({ mutate: disableMutate, isPending: false }),
}));

import { ScoreBadgeCard } from './ScoreBadgeCard';

afterEach(() => {
  useScoreBadge.mockReset();
  enableMutate.mockReset();
  disableMutate.mockReset();
  toast.mockReset();
});

describe('ScoreBadgeCard (EF-GROW-01)', () => {
  it('prompts to get a score when the candidate has none', () => {
    useScoreBadge.mockReturnValue({ data: { hasScore: false }, isLoading: false });
    render(<ScoreBadgeCard />);
    expect(screen.getByText('badge.needScore')).toBeInTheDocument();
  });

  it('shows the enable form when scored but not yet enabled, and enables', () => {
    useScoreBadge.mockReturnValue({
      data: { hasScore: true, enabled: false, badge: null, token: null },
      isLoading: false,
    });
    render(<ScoreBadgeCard />);
    fireEvent.click(screen.getByText('badge.enable'));
    expect(enableMutate).toHaveBeenCalled();
  });

  it('shows the public share link and showcase when enabled', () => {
    useScoreBadge.mockReturnValue({
      data: {
        hasScore: true,
        enabled: true,
        token: 'tok123',
        badge: { score: 82, percentile: 90 },
      },
      isLoading: false,
    });
    render(<ScoreBadgeCard />);
    expect(screen.getByTestId('showcase')).toBeInTheDocument();
    expect(screen.getByText('badge.shareLinkedin')).toBeInTheDocument();
    // The public link input carries the token.
    const input = screen.getByDisplayValue(/badge\/tok123$/);
    expect(input).toBeInTheDocument();
  });
});
