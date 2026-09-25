import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AuditLogPage } from '@/features/admin/moderation';

vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({ locale: 'fr', setLocale: vi.fn(), t: (k: string) => k, ta: () => [] }),
}));
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }),
}));
vi.mock('@/lib/format', () => ({ formatDateCasablanca: () => '01/06/2026' }));

const useAuditLogs = vi.fn();
vi.mock('@/features/admin/moderation', () => ({ useAuditLogs: () => useAuditLogs() }));

import AdminAuditLogsPage from './page';

afterEach(() => useAuditLogs.mockReset());

const page: AuditLogPage = {
  items: [
    {
      id: 'a1',
      action: 'moderation.action',
      actorId: 'admin-1',
      entityType: 'candidate_profile',
      entityId: 'p1abcdef',
      ipAddress: '10.0.0.1',
      createdAt: '2026-06-01T00:00:00.000Z',
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
  pageCount: 1,
};

describe('AdminAuditLogsPage (EF-ADM-04)', () => {
  it('shows skeletons while loading', () => {
    useAuditLogs.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = render(<AdminAuditLogsPage />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders the empty state', () => {
    useAuditLogs.mockReturnValue({
      data: { ...page, items: [] },
      isLoading: false,
      isError: false,
    });
    render(<AdminAuditLogsPage />);
    expect(screen.getByText('auditLog.empty')).toBeInTheDocument();
  });

  it('renders an audit row with its action and actor', () => {
    useAuditLogs.mockReturnValue({ data: page, isLoading: false, isError: false });
    render(<AdminAuditLogsPage />);
    expect(screen.getByText('moderation.action')).toBeInTheDocument();
    expect(screen.getByText('admin-1')).toBeInTheDocument();
  });
});
