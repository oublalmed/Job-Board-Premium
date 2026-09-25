import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { InvoiceSummary } from './queries';

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
  formatCurrencyMAD: (n: number) => `${n.toFixed(2)} MAD`,
  formatDateCasablanca: () => '01/06/2026',
}));

const useInvoices = vi.fn();
const downloadMutate = vi.fn();
vi.mock('./queries', () => ({
  useInvoices: () => useInvoices(),
  useDownloadInvoice: () => ({
    mutate: downloadMutate,
    isPending: false,
    variables: undefined,
  }),
}));

import { InvoicesCard } from './InvoicesCard';

function invoice(over: Partial<InvoiceSummary> = {}): InvoiceSummary {
  return {
    id: 'inv-1',
    invoiceNumber: 'FAC-2026-0001',
    amountHT: 10000,
    vatRate: 20,
    vatAmount: 2000,
    amountTTC: 12000,
    currency: 'MAD',
    companyIce: '001122334455667',
    issuedAt: '2026-06-01T00:00:00.000Z',
    ...over,
  };
}

afterEach(() => {
  useInvoices.mockReset();
  downloadMutate.mockReset();
  toast.mockReset();
});

describe('InvoicesCard (EF-BILL-03)', () => {
  it('renders the empty state', () => {
    useInvoices.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<InvoicesCard />);
    expect(screen.getByText('billing.invoicesEmpty')).toBeInTheDocument();
  });

  it('renders an error state', () => {
    useInvoices.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<InvoicesCard />);
    expect(screen.getByText('billing.invoicesError')).toBeInTheDocument();
  });

  it('lists invoices with number and TTC amount (centimes → MAD)', () => {
    useInvoices.mockReturnValue({
      data: [invoice()],
      isLoading: false,
      isError: false,
    });
    render(<InvoicesCard />);
    expect(screen.getByText('FAC-2026-0001')).toBeInTheDocument();
    // 12000 centimes → 120.00 MAD
    expect(screen.getByText('120.00 MAD')).toBeInTheDocument();
  });

  it('downloads an invoice via its id', () => {
    useInvoices.mockReturnValue({
      data: [invoice({ id: 'inv-42' })],
      isLoading: false,
      isError: false,
    });
    render(<InvoicesCard />);
    fireEvent.click(
      screen.getByLabelText('billing.download FAC-2026-0001'),
    );
    expect(downloadMutate).toHaveBeenCalled();
    expect(downloadMutate.mock.calls[0][0]).toBe('inv-42');
  });
});
