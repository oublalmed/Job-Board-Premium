import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { DataRequest } from '@/features/admin/data-requests';

vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({ locale: 'fr', setLocale: vi.fn(), t: (k: string) => k, ta: () => [] }),
}));
const toast = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }),
}));
vi.mock('@/lib/format', () => ({ formatDateCasablanca: () => '30/06/2026' }));

const useDataRequests = vi.fn();
const resolveMutate = vi.fn();
vi.mock('@/features/admin/data-requests', () => ({
  useDataRequests: () => useDataRequests(),
  useResolveDataRequest: () => ({ mutate: resolveMutate, isPending: false, variables: undefined }),
}));

import AdminDataRequestsPage from './page';

function req(over: Partial<DataRequest> = {}): DataRequest {
  return {
    id: 'dr1',
    userId: 'u1',
    type: 'erasure',
    status: 'pending',
    message: 'Please erase my data',
    resolutionNote: null,
    handledByUserId: null,
    dueAt: '2026-06-30T00:00:00.000Z',
    resolvedAt: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...over,
  };
}

afterEach(() => {
  useDataRequests.mockReset();
  resolveMutate.mockReset();
  toast.mockReset();
});

describe('AdminDataRequestsPage (EF-ADM-03)', () => {
  it('shows skeletons while loading', () => {
    useDataRequests.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = render(<AdminDataRequestsPage />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders the empty state', () => {
    useDataRequests.mockReturnValue({
      data: { items: [], total: 0, page: 1, limit: 20, pageCount: 1 },
      isLoading: false,
      isError: false,
    });
    render(<AdminDataRequestsPage />);
    expect(screen.getByText('dataRequests.empty')).toBeInTheDocument();
  });

  it('lists a pending request and resolves it (start)', () => {
    useDataRequests.mockReturnValue({
      data: { items: [req()], total: 1, page: 1, limit: 20, pageCount: 1 },
      isLoading: false,
      isError: false,
    });
    render(<AdminDataRequestsPage />);
    expect(screen.getByText('Please erase my data')).toBeInTheDocument();

    fireEvent.click(screen.getByText('dataRequests.start'));
    expect(resolveMutate).toHaveBeenCalled();
    expect(resolveMutate.mock.calls[0][0]).toMatchObject({ id: 'dr1', status: 'in_progress' });
  });
});
