import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { InterviewView } from './queries';

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

vi.mock('@/lib/format', () => ({
  formatDateCasablanca: () => '01/01/2030 10:00',
}));

const useInterviews = vi.fn();
const proposeMutate = vi.fn();
const respondMutate = vi.fn();
vi.mock('./queries', () => ({
  useInterviews: () => useInterviews(),
  useProposeInterview: () => ({ mutate: proposeMutate, isPending: false }),
  useRespondInterview: () => ({ mutate: respondMutate, isPending: false }),
}));

import { InterviewPanel } from './InterviewPanel';

function iv(over: Partial<InterviewView> = {}): InterviewView {
  return {
    id: 'iv-1',
    status: 'proposed',
    mode: 'video',
    scheduledAt: '2030-01-01T10:00:00.000Z',
    durationMinutes: 60,
    location: 'https://meet.example/x',
    note: null,
    proposedByRole: 'recruiter',
    mine: false,
    respondedAt: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    ...over,
  };
}

afterEach(() => {
  useInterviews.mockReset();
  proposeMutate.mockReset();
  respondMutate.mockReset();
  toast.mockReset();
});

describe('InterviewPanel (EF-MSG-04)', () => {
  it('renders the empty state when there are no interviews', () => {
    useInterviews.mockReturnValue({ data: [], isLoading: false });
    render(<InterviewPanel conversationId="c1" />);
    expect(screen.getByText('interviews.empty')).toBeInTheDocument();
  });

  it('shows accept/decline to the counterpart on a proposed slot and responds', () => {
    useInterviews.mockReturnValue({ data: [iv({ mine: false })], isLoading: false });
    render(<InterviewPanel conversationId="c1" />);

    expect(screen.getByText('interviews.status_proposed')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('interviews.accept'));
    expect(respondMutate).toHaveBeenCalled();
    expect(respondMutate.mock.calls[0][0]).toEqual({
      interviewId: 'iv-1',
      status: 'accepted',
    });
  });

  it('shows only cancel to the proposer (no accept/decline)', () => {
    useInterviews.mockReturnValue({ data: [iv({ mine: true })], isLoading: false });
    render(<InterviewPanel conversationId="c1" />);

    expect(screen.queryByLabelText('interviews.accept')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('interviews.cancelProposal'));
    expect(respondMutate.mock.calls[0][0]).toEqual({
      interviewId: 'iv-1',
      status: 'cancelled',
    });
  });

  it('shows no actions on a terminal (accepted) interview', () => {
    useInterviews.mockReturnValue({
      data: [iv({ status: 'accepted', mine: false })],
      isLoading: false,
    });
    render(<InterviewPanel conversationId="c1" />);
    expect(screen.getByText('interviews.status_accepted')).toBeInTheDocument();
    expect(screen.queryByLabelText('interviews.accept')).not.toBeInTheDocument();
    expect(screen.queryByText('interviews.cancelProposal')).not.toBeInTheDocument();
  });

  it('proposes a future slot from the form', () => {
    useInterviews.mockReturnValue({ data: [], isLoading: false });
    render(<InterviewPanel conversationId="c1" />);

    fireEvent.click(screen.getByText('interviews.propose'));
    fireEvent.change(screen.getByLabelText('interviews.date'), {
      target: { value: '2030-01-01T10:00' },
    });
    fireEvent.click(screen.getByText('interviews.submit'));

    expect(proposeMutate).toHaveBeenCalled();
    const payload = proposeMutate.mock.calls[0][0] as { mode: string; scheduledAt: string };
    expect(payload.mode).toBe('video');
    expect(new Date(payload.scheduledAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a past date with a toast rather than calling the mutation', () => {
    useInterviews.mockReturnValue({ data: [], isLoading: false });
    render(<InterviewPanel conversationId="c1" />);

    fireEvent.click(screen.getByText('interviews.propose'));
    fireEvent.change(screen.getByLabelText('interviews.date'), {
      target: { value: '2000-01-01T10:00' },
    });
    fireEvent.click(screen.getByText('interviews.submit'));

    expect(proposeMutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('interviews.invalidDate', 'error');
  });
});
