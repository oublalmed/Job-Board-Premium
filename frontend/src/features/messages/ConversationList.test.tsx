import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ConversationSummary } from './queries';

vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({
    locale: 'fr',
    setLocale: vi.fn(),
    t: (key: string) => key,
    ta: () => [],
  }),
}));

const useConversations = vi.fn();
vi.mock('./queries', () => ({
  useConversations: () => useConversations(),
}));

import { ConversationList } from './ConversationList';

function makeConversation(
  over: Partial<ConversationSummary> = {},
): ConversationSummary {
  return {
    id: 'c1',
    status: 'open',
    companyId: 'co1',
    companyName: 'Acme',
    companyLogo: null,
    candidateProfileId: 'p1',
    candidateName: 'Youssef E.',
    counterpartName: 'Youssef E.',
    lastMessage: {
      body: 'Bonjour, intéressé par le poste ?',
      senderRole: 'recruiter',
      createdAt: '2026-06-01T10:00:00.000Z',
    },
    unreadCount: 0,
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...over,
  };
}

afterEach(() => useConversations.mockReset());

describe('ConversationList (EF-MSG-01)', () => {
  it('shows skeletons while loading', () => {
    useConversations.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(
      <ConversationList selectedId={null} onSelect={vi.fn()} />,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders the empty state when there are no threads', () => {
    useConversations.mockReturnValue({ data: [], isLoading: false });
    render(<ConversationList selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText('messages.noConversations')).toBeInTheDocument();
  });

  it('lists counterpart name, last-message preview and the unread badge', () => {
    useConversations.mockReturnValue({
      data: [makeConversation({ unreadCount: 3 })],
      isLoading: false,
    });
    render(<ConversationList selectedId={null} onSelect={vi.fn()} />);

    expect(screen.getByText('Youssef E.')).toBeInTheDocument();
    expect(
      screen.getByText('Bonjour, intéressé par le poste ?'),
    ).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('hides the unread badge when there is nothing unread', () => {
    useConversations.mockReturnValue({
      data: [makeConversation({ unreadCount: 0 })],
      isLoading: false,
    });
    render(<ConversationList selectedId={null} onSelect={vi.fn()} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('calls onSelect with the thread id when a row is clicked', async () => {
    const onSelect = vi.fn();
    useConversations.mockReturnValue({
      data: [makeConversation({ id: 'c-42' })],
      isLoading: false,
    });
    render(<ConversationList selectedId={null} onSelect={onSelect} />);

    screen.getByRole('button').click();
    expect(onSelect).toHaveBeenCalledWith('c-42');
  });
});
