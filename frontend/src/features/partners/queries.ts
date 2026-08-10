'use client';

import { useQuery } from '@tanstack/react-query';

// Public landing showcase. Post-dates the last OpenAPI generation, so it uses
// fetch directly rather than the generated client (regenerate with
// `npm run generate:api` to fold it in). No auth — the endpoint is public.
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export interface PartnerCompany {
  id: string;
  name: string;
  logo: string | null;
  sector: string | null;
}

export function usePartners() {
  return useQuery({
    queryKey: ['partners'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PartnerCompany[]> => {
      const res = await fetch(`${BASE}/api/v1/companies/partners`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as PartnerCompany[];
    },
  });
}
