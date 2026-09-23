import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Mock the surrounding app context so the card renders in isolation. ---

vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({
    locale: 'fr',
    setLocale: vi.fn(),
    t: (key: string) => key,
    ta: () => [],
  }),
}));

const logout = vi.fn();
vi.mock('@/auth/auth-context', () => ({
  useAuth: () => ({
    // A candidate user — the data-export card only renders for candidates.
    user: { email: 'cand@example.com', roles: ['candidate'] },
    isLoading: false,
    login: vi.fn(),
    logout,
  }),
}));

const toast = vi.fn();
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast }),
}));

// The three data-export/delete mutations. mutate is asserted against below.
const exportJsonMutate = vi.fn();
const exportPdfMutate = vi.fn();
const deleteMutate = vi.fn();
vi.mock('@/features/settings/queries', () => ({
  useExportData: () => ({ mutate: exportJsonMutate, isPending: false }),
  useExportDataPdf: () => ({ mutate: exportPdfMutate, isPending: false }),
  useDeleteAccount: () => ({ mutate: deleteMutate, isPending: false }),
}));

// Sibling cards are out of scope for this test.
vi.mock('@/features/data-requests/DataRequestsCard', () => ({
  DataRequestsCard: () => null,
}));
vi.mock('@/features/settings/SecurityCard', () => ({
  SecurityCard: () => null,
}));

// framer-motion: render a plain div, dropping animation-only props.
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get:
        () =>
        ({
          children,
          className,
        }: {
          children?: React.ReactNode;
          className?: string;
        }) => <div className={className}>{children}</div>,
    },
  ),
}));

import SettingsPage from './page';

afterEach(() => {
  exportJsonMutate.mockReset();
  exportPdfMutate.mockReset();
  deleteMutate.mockReset();
  toast.mockReset();
});

describe('SettingsPage data-export card', () => {
  it('renders both the JSON and PDF export buttons', () => {
    render(<SettingsPage />);
    expect(
      screen.getByRole('button', { name: 'settings.exportJson' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'settings.exportPdf' }),
    ).toBeInTheDocument();
  });

  it('calls the JSON export mutation when "Export (JSON)" is clicked', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(
      screen.getByRole('button', { name: 'settings.exportJson' }),
    );

    expect(exportJsonMutate).toHaveBeenCalledTimes(1);
    expect(exportPdfMutate).not.toHaveBeenCalled();
  });

  it('calls the PDF export mutation when "Export (PDF)" is clicked', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(
      screen.getByRole('button', { name: 'settings.exportPdf' }),
    );

    expect(exportPdfMutate).toHaveBeenCalledTimes(1);
    expect(exportJsonMutate).not.toHaveBeenCalled();
  });
});
