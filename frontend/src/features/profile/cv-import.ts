'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '@/auth/token-store';
import { profileKeys } from './queries';

// §1 — mirrors the backend CvSuggestions (src/modules/candidates/cv-parsing.ts).
export interface CvSuggestions {
  links: { type: string; url: string }[];
  experiences: {
    type: 'work' | 'education';
    title: string;
    organization: string;
    description: string;
  }[];
  projects: { title: string; description: string; url: string | null }[];
  certifications: { name: string; issuer: string }[];
}

export interface ApplyCvImportPayload {
  experiences?: {
    type: 'work' | 'education';
    title: string;
    organization: string;
    startDate: string;
    endDate?: string;
    description?: string;
  }[];
  projects?: { title: string; description: string; url?: string }[];
  certifications?: {
    name: string;
    issuer: string;
    issueDate: string;
    expiryDate?: string;
    credentialUrl?: string;
  }[];
  links?: { type: string; url: string; label?: string }[];
}

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// Upload the CV for analysis → structured suggestions (nothing is saved yet).
export function useParseCv() {
  return useMutation({
    mutationFn: async (file: File): Promise<CvSuggestions> => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${BASE}/api/v1/candidates/cv/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: form,
      });
      if (!res.ok) throw new Error(`Import failed (${res.status})`);
      const data = (await res.json()) as { suggestions: CvSuggestions };
      return data.suggestions;
    },
  });
}

// Save the candidate-reviewed subset.
export function useApplyCvImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: ApplyCvImportPayload,
    ): Promise<{
      created: {
        experiences: number;
        projects: number;
        certifications: number;
        links: number;
      };
    }> => {
      const res = await fetch(`${BASE}/api/v1/candidates/cv/import/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Apply failed (${res.status})`);
      return res.json() as Promise<{
        created: {
          experiences: number;
          projects: number;
          certifications: number;
          links: number;
        };
      }>;
    },
    onSuccess: () => {
      // The new rows change completeness, links, certifications, projects…
      void qc.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}
