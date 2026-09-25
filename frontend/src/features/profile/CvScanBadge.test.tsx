import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// t() echoes the key so assertions stay locale-independent.
vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({ t: (k: string) => k }),
}));

import { CvScanBadge } from './CvScanBadge';

describe('CvScanBadge (EF-CAND-03)', () => {
  it('shows the clean status with a text label', () => {
    render(<CvScanBadge status="clean" />);
    expect(screen.getByText('profile.scanStatus.clean')).toBeInTheDocument();
  });

  it('shows the infected status', () => {
    render(<CvScanBadge status="infected" />);
    expect(screen.getByText('profile.scanStatus.infected')).toBeInTheDocument();
  });

  it('falls back to pending for an unknown status', () => {
    render(<CvScanBadge status="weird-unexpected" />);
    expect(screen.getByText('profile.scanStatus.pending')).toBeInTheDocument();
  });

  it('marks the icon aria-hidden so it is not announced', () => {
    const { container } = render(<CvScanBadge status="clean" />);
    const icon = container.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
