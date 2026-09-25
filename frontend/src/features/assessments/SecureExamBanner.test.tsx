import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecureExamBanner } from './SecureExamBanner';
import type { SecureExam } from './use-secure-exam';

// t() echoes the key so assertions don't depend on locale content.
vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({ t: (k: string) => k }),
}));

function makeExam(overrides: Partial<SecureExam> = {}): SecureExam {
  return {
    active: true,
    isFullscreen: true,
    tabHidden: false,
    windowBlurred: false,
    leaveCount: 0,
    tabSwitchCount: 0,
    windowBlurCount: 0,
    enterFullscreen: vi.fn().mockResolvedValue(undefined),
    exitFullscreen: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('SecureExamBanner (EF-EVAL-02)', () => {
  it('renders nothing when the secure-exam mode is inactive', () => {
    const { container } = render(
      <SecureExamBanner exam={makeExam({ active: false })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the title and no warning when fullscreen and focused', () => {
    render(<SecureExamBanner exam={makeExam()} />);
    expect(screen.getByText('secureExam.title')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns and offers to re-enter fullscreen when not fullscreen', () => {
    render(<SecureExamBanner exam={makeExam({ isFullscreen: false })} />);
    expect(screen.getByText('secureExam.enterFullscreen')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'secureExam.warnNotFullscreen',
    );
  });

  it('warns with a leave count when the candidate left the tab', () => {
    render(
      <SecureExamBanner
        exam={makeExam({ tabHidden: true, leaveCount: 2 })}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('secureExam.warnLeftTab');
    expect(alert).toHaveTextContent('secureExam.leaveCount');
  });
});
