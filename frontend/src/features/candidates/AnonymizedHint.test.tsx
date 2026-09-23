import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// t() echoes the key so assertions read against stable, locale-independent
// strings rather than the FR/EN copy.
vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({
    locale: 'fr',
    setLocale: vi.fn(),
    t: (key: string) => key,
    ta: () => [],
  }),
}));

import { AnonymizedHint } from './AnonymizedHint';
import { isAnonymized, type CandidateResult } from './types';

describe('isAnonymized', () => {
  it('is true only when the anonymized flag is exactly true', () => {
    expect(isAnonymized({ id: '1', anonymized: true })).toBe(true);
  });

  it('is false when the flag is missing or falsy', () => {
    const cases: CandidateResult[] = [
      { id: '1' },
      { id: '2', anonymized: false },
      { id: '3', anonymized: undefined },
    ];
    for (const c of cases) {
      expect(isAnonymized(c)).toBe(false);
    }
  });
});

describe('AnonymizedHint', () => {
  it('renders the anonymised-preview caption with a tooltip title', () => {
    render(<AnonymizedHint />);

    // The visible + accessible label, mirrored into `title` for hover.
    const labels = screen.getAllByText('search.anonymizedHint');
    expect(labels.length).toBeGreaterThan(0);
    expect(
      document.querySelector('[title="search.anonymizedHint"]'),
    ).toBeInTheDocument();
  });

  it('marks the lock icon aria-hidden so it is not announced', () => {
    const { container } = render(<AnonymizedHint />);
    const icon = container.querySelector('svg');
    expect(icon).toBeTruthy();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
