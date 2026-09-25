import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreMeter, PercentileBar } from './ScoreMeter';

describe('ScoreMeter (EF-EVAL-03)', () => {
  it('renders the numeric value and an accessible progressbar', () => {
    render(<ScoreMeter label="Overall" value={72.4} />);
    // value is shown as text (never colour/width alone)
    expect(screen.getByText('72/100')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '72');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-label', 'Overall: 72/100');
  });

  it('clamps the fill width to the 0–100 range', () => {
    const { container } = render(<ScoreMeter label="X" value={140} />);
    const fill = container.querySelector('[style*="width"]') as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });
});

describe('PercentileBar (EF-EVAL-04)', () => {
  it('shows the ranking caption and a progressbar filled to the percentile', () => {
    render(
      <PercentileBar label="Ranking" rankLabel="Top 15%" percentile={85} />,
    );
    expect(screen.getByText('Top 15%')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '85');
    expect(bar).toHaveAttribute('aria-label', 'Top 15%');
  });
});
