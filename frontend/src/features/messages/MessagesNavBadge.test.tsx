import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({
    locale: 'fr',
    setLocale: vi.fn(),
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}|count=${vars.count}` : key,
    ta: () => [],
  }),
}));

// The badge reads the unread count through this hook; mock it per-test.
const unreadMock = vi.fn<() => number>();
vi.mock('./queries', () => ({
  useUnreadMessageCount: () => unreadMock(),
}));

import { MessagesNavBadge } from './MessagesNavBadge';
import { sumUnread } from './queries.helpers';

describe('sumUnread (EF-MSG-02)', () => {
  it('adds up positive unread counts and ignores negatives / undefined', () => {
    expect(sumUnread(undefined)).toBe(0);
    expect(sumUnread([])).toBe(0);
    expect(
      sumUnread([{ unreadCount: 2 }, { unreadCount: 0 }, { unreadCount: 3 }]),
    ).toBe(5);
    expect(sumUnread([{ unreadCount: -1 }, { unreadCount: 4 }])).toBe(4);
  });
});

describe('MessagesNavBadge (EF-MSG-02)', () => {
  it('renders nothing when there is nothing unread', () => {
    unreadMock.mockReturnValue(0);
    const { container } = render(<MessagesNavBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the exact count and an announced label when there are unread messages', () => {
    unreadMock.mockReturnValue(3);
    render(<MessagesNavBadge />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(
      document.querySelector('[aria-label="messages.unreadBadge|count=3"]'),
    ).toBeInTheDocument();
  });

  it('caps the display at "9+" but keeps the true count in the label', () => {
    unreadMock.mockReturnValue(42);
    render(<MessagesNavBadge />);
    expect(screen.getByText('9+')).toBeInTheDocument();
    expect(
      document.querySelector('[aria-label="messages.unreadBadge|count=42"]'),
    ).toBeInTheDocument();
  });
});
