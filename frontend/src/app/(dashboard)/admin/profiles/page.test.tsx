import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ModeratedProfile } from '@/features/admin/profiles';

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

const useModeratedProfiles = vi.fn();
const moderateMutate = vi.fn();
vi.mock('@/features/admin/profiles', () => ({
  useModeratedProfiles: () => useModeratedProfiles(),
  useModerateProfile: () => ({
    mutate: moderateMutate,
    isPending: false,
    variables: undefined,
  }),
}));

import AdminProfilesPage from './page';

function profile(over: Partial<ModeratedProfile> = {}): ModeratedProfile {
  return {
    id: 'p1',
    firstName: 'Sara',
    lastName: 'B',
    headline: 'Backend dev',
    visibility: 'public',
    moderationStatus: 'active',
    createdAt: '2026-06-01T00:00:00.000Z',
    ...over,
  };
}

afterEach(() => {
  useModeratedProfiles.mockReset();
  moderateMutate.mockReset();
  toast.mockReset();
});

describe('AdminProfilesPage (EF-ADM-01)', () => {
  it('renders the empty state', () => {
    useModeratedProfiles.mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
      isError: false,
    });
    render(<AdminProfilesPage />);
    expect(screen.getByText('adminProfiles.empty')).toBeInTheDocument();
  });

  it('suspends an active profile', () => {
    useModeratedProfiles.mockReturnValue({
      data: { items: [profile()], total: 1 },
      isLoading: false,
      isError: false,
    });
    render(<AdminProfilesPage />);
    expect(screen.getByText('Sara B')).toBeInTheDocument();
    expect(screen.getByText('adminProfiles.status_active')).toBeInTheDocument();

    fireEvent.click(screen.getByText('adminProfiles.suspend'));
    expect(moderateMutate.mock.calls[0][0]).toEqual({ id: 'p1', status: 'suspended' });
  });

  it('reinstates a suspended profile', () => {
    useModeratedProfiles.mockReturnValue({
      data: { items: [profile({ moderationStatus: 'suspended' })], total: 1 },
      isLoading: false,
      isError: false,
    });
    render(<AdminProfilesPage />);
    expect(screen.getByText('adminProfiles.status_suspended')).toBeInTheDocument();

    fireEvent.click(screen.getByText('adminProfiles.reinstate'));
    expect(moderateMutate.mock.calls[0][0]).toEqual({ id: 'p1', status: 'active' });
  });
});
