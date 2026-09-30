import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { MessageView } from './queries';

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
  formatDateCasablanca: () => '01/06/2026 10:00',
}));

// InterviewPanel is exercised by its own test; stub it here so this suite's
// ./queries mock need not also stub the interview hooks.
vi.mock('./InterviewPanel', () => ({ InterviewPanel: () => null }));

const useMessages = vi.fn();
const sendMutate = vi.fn();
const reportMutate = vi.fn();

vi.mock('./queries', () => ({
  useMessages: () => useMessages(),
  useSendMessage: () => ({ mutate: sendMutate, isPending: false }),
  useReportConversation: () => ({ mutate: reportMutate, isPending: false }),
}));

import { MessageThread } from './MessageThread';

function msg(over: Partial<MessageView> = {}): MessageView {
  return {
    id: 'm1',
    body: 'Hello there',
    senderRole: 'recruiter',
    mine: false,
    readAt: null,
    createdAt: '2026-06-01T10:00:00.000Z',
    attachment: null,
    ...over,
  };
}

afterEach(() => {
  useMessages.mockReset();
  sendMutate.mockReset();
  reportMutate.mockReset();
  toast.mockReset();
});

describe('MessageThread (EF-MSG-01/05)', () => {
  it('renders the empty-thread hint when there are no messages', () => {
    useMessages.mockReturnValue({ data: [], isLoading: false });
    render(<MessageThread conversationId="c1" />);
    expect(screen.getByText('messages.emptyThread')).toBeInTheDocument();
  });

  it('renders incoming and outgoing message bodies', () => {
    useMessages.mockReturnValue({
      data: [
        msg({ id: 'a', body: 'From them', mine: false }),
        msg({ id: 'b', body: 'From me', mine: true }),
      ],
      isLoading: false,
    });
    render(<MessageThread conversationId="c1" />);
    expect(screen.getByText('From them')).toBeInTheDocument();
    expect(screen.getByText('From me')).toBeInTheDocument();
  });

  it('EF-MSG-05 — toggles the abuse-report form and submits a reason', () => {
    useMessages.mockReturnValue({ data: [msg()], isLoading: false });
    render(<MessageThread conversationId="c1" />);

    // Reason field is hidden until "report" is toggled.
    expect(screen.queryByLabelText('messages.reportReasonLabel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('messages.report'));

    const reason = screen.getByLabelText('messages.reportReasonLabel');
    fireEvent.change(reason, { target: { value: 'spam abusif' } });
    fireEvent.click(screen.getByText('messages.reportSubmit'));

    expect(reportMutate).toHaveBeenCalled();
    expect(reportMutate.mock.calls[0][0]).toBe('spam abusif');
  });

  it('disables the send button until there is a non-empty draft', () => {
    useMessages.mockReturnValue({ data: [msg()], isLoading: false });
    render(<MessageThread conversationId="c1" />);

    const sendBtn = screen.getByLabelText('messages.send');
    expect(sendBtn).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('messages.replyPlaceholder'), {
      target: { value: 'ma réponse' },
    });
    expect(sendBtn).not.toBeDisabled();
  });
});
