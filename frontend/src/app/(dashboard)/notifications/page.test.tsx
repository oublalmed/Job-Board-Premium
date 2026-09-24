import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Notification } from '@/features/notifications/queries';

vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({ locale: 'fr', setLocale: vi.fn(), t: (k: string) => k, ta: () => [] }),
}));
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }),
}));

const useNotifications = vi.fn();
const markReadMutate = vi.fn();
const markAllMutate = vi.fn();
vi.mock('@/features/notifications/queries', () => ({
  useNotifications: () => useNotifications(),
  useMarkNotificationRead: () => ({ mutate: markReadMutate, isPending: false }),
  useMarkAllNotificationsRead: () => ({ mutate: markAllMutate, isPending: false }),
}));

import NotificationsPage from './page';

function notif(over: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    type: 'profile_viewed',
    title: 'Un recruteur a consulté votre profil',
    body: 'Acme a vu votre profil',
    readAt: null,
    createdAt: new Date().toISOString(),
    ...over,
  } as Notification;
}

afterEach(() => {
  useNotifications.mockReset();
  markReadMutate.mockReset();
  markAllMutate.mockReset();
});

describe('NotificationsPage (EF-GROW-04 social-proof surface)', () => {
  it('renders the empty state', () => {
    useNotifications.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<NotificationsPage />);
    expect(screen.getByText('notifications.empty')).toBeInTheDocument();
  });

  it('renders a "recruiter viewed you" notification with title + body', () => {
    useNotifications.mockReturnValue({ data: [notif()], isLoading: false, isError: false });
    render(<NotificationsPage />);
    expect(screen.getByText('Un recruteur a consulté votre profil')).toBeInTheDocument();
    expect(screen.getByText('Acme a vu votre profil')).toBeInTheDocument();
  });

  it('marks a single notification read and marks all read', () => {
    useNotifications.mockReturnValue({
      data: [notif(), notif({ id: 'n2', type: 'new_message', readAt: null })],
      isLoading: false,
      isError: false,
    });
    render(<NotificationsPage />);

    // Per-row mark-read (two unread → two buttons); click the first.
    fireEvent.click(screen.getAllByLabelText('notifications.markRead')[0]);
    expect(markReadMutate).toHaveBeenCalledWith('n1');

    fireEvent.click(screen.getByText('notifications.markAllRead'));
    expect(markAllMutate).toHaveBeenCalled();
  });
});
