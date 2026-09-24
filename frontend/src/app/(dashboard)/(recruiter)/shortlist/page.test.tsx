import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({
    locale: 'fr',
    setLocale: vi.fn(),
    t: (key: string) => key,
    ta: () => [],
  }),
}));

const toast = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast }) }));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, className }: { children?: React.ReactNode; className?: string }) => (
          <div className={className}>{children}</div>
        ),
    },
  ),
}));

const useShortlist = vi.fn();
const removeMutate = vi.fn();
vi.mock('@/features/shortlist/queries', () => ({
  useShortlist: () => useShortlist(),
  useRemoveShortlistEntry: () => ({
    mutate: removeMutate,
    isPending: false,
    variables: undefined,
  }),
}));

import ShortlistPage from './page';

afterEach(() => {
  useShortlist.mockReset();
  removeMutate.mockReset();
  toast.mockReset();
});

describe('ShortlistPage — EF-RECR-06 (viviers)', () => {
  it('renders the empty state with a link back to search', () => {
    useShortlist.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<ShortlistPage />);
    expect(screen.getByText('shortlist.empty')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/candidates');
  });

  it('lists shortlisted candidates with their headline and note', () => {
    useShortlist.mockReturnValue({
      data: [
        {
          id: 's1',
          note: 'Fort en back-end',
          createdAt: '2026-06-01T00:00:00.000Z',
          candidateProfile: {
            id: 'p1',
            firstName: 'Sara',
            lastName: 'B.',
            headline: 'Ingénieure logicielle',
          },
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<ShortlistPage />);

    expect(screen.getByText('Sara B.')).toBeInTheDocument();
    expect(screen.getByText('Ingénieure logicielle')).toBeInTheDocument();
    expect(screen.getByText('Fort en back-end')).toBeInTheDocument();
    // The candidate name links to the (full) candidate detail page.
    expect(screen.getByRole('link', { name: /Sara/ })).toHaveAttribute(
      'href',
      '/candidates/p1',
    );
  });

  it('removes an entry (after confirm) by its id', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    useShortlist.mockReturnValue({
      data: [
        {
          id: 's1',
          createdAt: '2026-06-01T00:00:00.000Z',
          candidateProfile: { id: 'p1', firstName: 'Sara', lastName: 'B.' },
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<ShortlistPage />);

    fireEvent.click(screen.getByLabelText('common.delete'));
    expect(removeMutate).toHaveBeenCalled();
    expect(removeMutate.mock.calls[0][0]).toBe('s1');
  });

  it('does not remove when the confirm dialog is dismissed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    useShortlist.mockReturnValue({
      data: [
        {
          id: 's1',
          createdAt: '2026-06-01T00:00:00.000Z',
          candidateProfile: { id: 'p1', firstName: 'Sara', lastName: 'B.' },
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<ShortlistPage />);

    fireEvent.click(screen.getByLabelText('common.delete'));
    expect(removeMutate).not.toHaveBeenCalled();
  });

  it('shows an error state with a retry action', () => {
    const refetch = vi.fn();
    useShortlist.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });
    render(<ShortlistPage />);

    fireEvent.click(screen.getByText('common.retry'));
    expect(refetch).toHaveBeenCalled();
  });
});
