import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ProfileLink } from './queries';

// t() echoes the key so assertions stay locale-independent.
vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({ locale: 'fr', setLocale: vi.fn(), t: (k: string) => k }),
}));
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const reverifyMutate = vi.fn();
const links: ProfileLink[] = [
  {
    id: 'l1',
    type: 'github',
    url: 'https://github.com/me',
    label: null,
    accessibilityStatus: 'reachable',
    checkedAt: '2026-09-23T00:00:00.000Z',
    createdAt: '2026-09-23T00:00:00.000Z',
  },
  {
    id: 'l2',
    type: 'portfolio',
    url: 'https://broken.example',
    label: 'Portfolio',
    accessibilityStatus: 'unreachable',
    checkedAt: '2026-09-23T00:00:00.000Z',
    createdAt: '2026-09-23T00:00:00.000Z',
  },
];

vi.mock('./queries', () => ({
  useProfileLinks: () => ({ data: links, isLoading: false }),
  useAddProfileLink: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteProfileLink: () => ({
    mutate: vi.fn(),
    isPending: false,
    variables: undefined,
  }),
  useReverifyProfileLink: () => ({
    mutate: reverifyMutate,
    isPending: false,
    variables: undefined,
  }),
}));

import { ProfileLinksCard } from './ProfileLinksCard';

describe('ProfileLinksCard — EF-CAND-04 accessibility status', () => {
  beforeEach(() => reverifyMutate.mockClear());

  it('shows a reachable and an unreachable status label per link', () => {
    render(<ProfileLinksCard />);
    expect(screen.getByText('profileLinks.statusReachable')).toBeInTheDocument();
    expect(
      screen.getByText('profileLinks.statusUnreachable'),
    ).toBeInTheDocument();
  });

  it('re-check button is labelled with the link URL and triggers a re-verify', () => {
    render(<ProfileLinksCard />);
    const button = screen.getByLabelText(
      'profileLinks.recheck https://broken.example',
    );
    fireEvent.click(button);
    expect(reverifyMutate).toHaveBeenCalledWith('l2', expect.anything());
  });

  it('marks status icons aria-hidden so they are not announced', () => {
    const { container } = render(<ProfileLinksCard />);
    // Every rendered svg is decorative in this card.
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(0);
    icons.forEach((icon) => expect(icon).toHaveAttribute('aria-hidden', 'true'));
  });
});
