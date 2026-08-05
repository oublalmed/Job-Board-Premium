import { z } from 'zod';

// Mirrors CreateCompanyDto: name, ICE (15 digits — the Moroccan company
// identifier), optional registration number. Same constraints the original
// page enforced inline (name >= 2, /^\d{15}$/).
export const createCompanySchema = z.object({
  name: z.string().trim().min(2),
  ice: z.string().regex(/^\d{15}$/, 'ICE must be exactly 15 digits'),
  registrationNumber: z.string(),
});

export type CreateCompanyValues = z.infer<typeof createCompanySchema>;

export const EMPTY_COMPANY: CreateCompanyValues = {
  name: '',
  ice: '',
  registrationNumber: '',
};

export function toCreateCompanyPayload(v: CreateCompanyValues): Record<string, unknown> {
  const body: Record<string, unknown> = { name: v.name.trim(), ice: v.ice };
  if (v.registrationNumber.trim()) body.registrationNumber = v.registrationNumber.trim();
  return body;
}

// Mirrors AddRecruiterDto: email (required), optional position.
export const addRecruiterSchema = z.object({
  email: z.string().trim().email(),
  position: z.string(),
});

export type AddRecruiterValues = z.infer<typeof addRecruiterSchema>;

export const EMPTY_RECRUITER: AddRecruiterValues = { email: '', position: '' };

export function toAddRecruiterPayload(v: AddRecruiterValues): Record<string, unknown> {
  const body: Record<string, unknown> = { email: v.email.trim() };
  if (v.position.trim()) body.position = v.position.trim();
  return body;
}
