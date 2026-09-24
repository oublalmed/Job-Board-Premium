'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';

// These endpoints (GET /invoices, GET /companies/contact-quota) post-date the
// last OpenAPI generation, so — like referral/score-badge — they use
// fetch + bearer rather than the generated client. Regenerate with
// `npm run generate:api` against a live backend to fold them into the typed
// client later.
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  amountHT: number;
  vatRate: number;
  vatAmount: number;
  amountTTC: number;
  currency: string;
  companyIce: string;
  issuedAt: string;
}

export interface ContactQuotaStatus {
  active: boolean;
  plan: string | null;
  status: string | null;
  contactQuota: number | null;
  contactsUsed: number | null;
  contactsRemaining: number | null;
  quotaResetAt: string | null;
  // EF-BILL-02 — current period end (renewal/expiry) and whether a cancellation
  // is scheduled at that point. EF-BILL-05 — dunning: past-due since (or null).
  endsAt: string | null;
  cancelAtPeriodEnd: boolean;
  pastDueSince: string | null;
}

async function authedGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

export const billingKeys = {
  invoices: ['billing', 'invoices'] as const,
  quota: ['billing', 'contact-quota'] as const,
};

// EF-BILL-03 — the company's emitted invoices.
export function useInvoices() {
  return useQuery({
    queryKey: billingKeys.invoices,
    queryFn: () => authedGet<InvoiceSummary[]>('/api/v1/invoices'),
  });
}

// EF-RECR-05 / EF-BILL-04 — remaining contact quota, and the active/inactive
// signal the access banner keys off.
export function useContactQuota() {
  return useQuery({
    queryKey: billingKeys.quota,
    queryFn: () => authedGet<ContactQuotaStatus>('/api/v1/companies/contact-quota'),
  });
}

// EF-BILL-03 — resolve a short-lived signed URL for the archived PDF and hand
// it back so the caller can open it. The PDF is never exposed directly.
export function useDownloadInvoice() {
  return useMutation({
    mutationFn: (id: string) =>
      authedGet<{ url: string }>(`/api/v1/invoices/${id}`),
  });
}
