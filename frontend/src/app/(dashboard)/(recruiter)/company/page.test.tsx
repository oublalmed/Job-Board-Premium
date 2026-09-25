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

const roles = { current: ['company_admin'] as string[] };
vi.mock('@/auth/auth-context', () => ({
  useAuth: () => ({
    user: { email: 'admin@acme.com', roles: roles.current },
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
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

const useCompany = vi.fn();
const useRecruiters = vi.fn();
const createMutate = vi.fn();
const addMutate = vi.fn();
const removeMutate = vi.fn();
vi.mock('@/features/company/queries', () => ({
  useCompany: () => useCompany(),
  useRecruiters: () => useRecruiters(),
  useCreateCompany: () => ({ mutate: createMutate, isPending: false }),
  useAddRecruiter: () => ({ mutate: addMutate, isPending: false }),
  useRemoveRecruiter: () => ({
    mutate: removeMutate,
    isPending: false,
    variables: undefined,
  }),
}));

import CompanyPage from './page';

afterEach(() => {
  roles.current = ['company_admin'];
  useCompany.mockReset();
  useRecruiters.mockReset();
  createMutate.mockReset();
  addMutate.mockReset();
  removeMutate.mockReset();
  toast.mockReset();
});

describe('CompanyPage — EF-RECR-01 (KYB)', () => {
  it('renders the create-company / KYB form when the recruiter has no company', () => {
    useCompany.mockReturnValue({ data: null, isLoading: false });
    useRecruiters.mockReturnValue({ data: [] });

    render(<CompanyPage />);

    expect(screen.getByText('company.createTitle')).toBeInTheDocument();
    // ICE is the Moroccan KYB identifier — the field must be present.
    expect(screen.getByText('company.ice')).toBeInTheDocument();
    expect(screen.getByText('company.iceHint')).toBeInTheDocument();
  });

  it('caps the ICE input to 15 numeric characters (strips letters/symbols)', () => {
    useCompany.mockReturnValue({ data: null, isLoading: false });
    useRecruiters.mockReturnValue({ data: [] });

    render(<CompanyPage />);
    const ice = screen.getByPlaceholderText('company.icePlaceholder') as HTMLInputElement;
    ice.focus();
    // Fire a change with mixed garbage + more than 15 digits.
    fireEvent.change(ice, { target: { value: 'AB12-34xy5678901234567890' } });
    expect(ice.value).toBe('123456789012345');
    expect(ice.value).toHaveLength(15);
  });

  it('shows the verification status once a company exists', () => {
    useCompany.mockReturnValue({
      data: { name: 'Acme SARL', ice: '001122334455667', status: 'active' },
      isLoading: false,
    });
    useRecruiters.mockReturnValue({ data: [] });

    render(<CompanyPage />);
    expect(screen.getByText('Acme SARL')).toBeInTheDocument();
    expect(screen.getByText('001122334455667')).toBeInTheDocument();
    expect(screen.getByText('company.verified')).toBeInTheDocument();
  });
});

describe('CompanyPage — EF-RECR-02 (multi-user)', () => {
  const companyData = { data: { name: 'Acme', ice: '1', status: 'active' }, isLoading: false };

  it('lists recruiters and shows the add form to a company admin', () => {
    useCompany.mockReturnValue(companyData);
    useRecruiters.mockReturnValue({
      data: [{ id: 'r1', userId: 'u1', position: 'Lead', user: { email: 'lead@acme.com' } }],
    });

    render(<CompanyPage />);
    expect(screen.getByText('lead@acme.com')).toBeInTheDocument();
    // The add-recruiter form's email field is unambiguous proof the form renders.
    expect(screen.getByText('company.recruiterEmail')).toBeInTheDocument();
  });

  it('removing a recruiter calls the mutation with the recruiter id', () => {
    useCompany.mockReturnValue(companyData);
    useRecruiters.mockReturnValue({
      data: [{ id: 'r1', userId: 'u1', user: { email: 'lead@acme.com' } }],
    });

    render(<CompanyPage />);
    fireEvent.click(screen.getByLabelText('common.delete'));
    expect(removeMutate).toHaveBeenCalled();
    expect(removeMutate.mock.calls[0][0]).toBe('r1');
  });

  it('hides the add/remove controls from a non-admin recruiter', () => {
    roles.current = ['recruiter'];
    useCompany.mockReturnValue(companyData);
    useRecruiters.mockReturnValue({
      data: [{ id: 'r1', userId: 'u1', user: { email: 'lead@acme.com' } }],
    });

    render(<CompanyPage />);
    expect(screen.queryByText('company.addRecruiter')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('common.delete')).not.toBeInTheDocument();
  });
});
