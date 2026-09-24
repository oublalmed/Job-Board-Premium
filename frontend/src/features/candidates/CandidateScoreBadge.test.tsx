import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// t() echoes "key" or "key|k=v" so assertions read against stable,
// locale-independent strings rather than the FR/EN copy.
vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({
    locale: 'fr',
    setLocale: vi.fn(),
    t: (key: string, vars?: Record<string, string>) =>
      vars
        ? `${key}|${Object.entries(vars)
            .map(([k, v]) => `${k}=${v}`)
            .join(',')}`
        : key,
    ta: () => [],
  }),
}));

import { CandidateScoreBadge, topPercentile } from './CandidateScoreBadge';

describe('topPercentile', () => {
  it('is the complement of the percentile, clamped to 1–100', () => {
    expect(topPercentile(90)).toBe(10);
    expect(topPercentile(0)).toBe(100);
    expect(topPercentile(100)).toBe(1); // never "top 0%"
    expect(topPercentile(85.4)).toBe(15); // rounds
  });
});

describe('CandidateScoreBadge (EF-RECR-04)', () => {
  it('renders rank, score and the percentile band, with a composed aria-label', () => {
    render(<CandidateScoreBadge score={82.3} percentile={90} rank={3} />);

    expect(screen.getByText('#3')).toBeInTheDocument();
    expect(screen.getByText('82/100')).toBeInTheDocument();

    // The single announced label carries rank + score + "top 10%".
    const labelled = document.querySelector('[aria-label]') as HTMLElement;
    expect(labelled.getAttribute('aria-label')).toContain('search.rankPosition|rank=3');
    expect(labelled.getAttribute('aria-label')).toContain('search.score: 82/100');
    expect(labelled.getAttribute('aria-label')).toContain('search.topPercent|pct=10');
  });

  it('omits the percentile band when percentile is null', () => {
    render(<CandidateScoreBadge score={50} percentile={null} rank={1} />);
    const labelled = document.querySelector('[aria-label]') as HTMLElement;
    expect(labelled.getAttribute('aria-label')).not.toContain('topPercent');
    expect(screen.getByText('50/100')).toBeInTheDocument();
  });

  it('shows a neutral placeholder — never "0" — when there is no eligible score', () => {
    render(<CandidateScoreBadge score={0} rank={5} />);
    expect(screen.getByText('search.noScore')).toBeInTheDocument();
    expect(screen.queryByText('#5')).not.toBeInTheDocument();
    expect(screen.queryByText('0/100')).not.toBeInTheDocument();
  });

  it('marks the decorative icon aria-hidden', () => {
    const { container } = render(<CandidateScoreBadge score={70} percentile={50} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
