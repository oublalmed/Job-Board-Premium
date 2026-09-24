import { z } from 'zod';

export const VISIBILITY_OPTIONS = ['public', 'recruiters_only', 'hidden'] as const;

// Mirrors the backend UpdateProfileDto EXACTLY (EF-CAND-02): the max-lengths
// here are the same bounds declared with @MaxLength server-side, so the client
// never rejects a payload the API would accept, nor vice-versa. All fields are
// optional (empty allowed); `toUpdatePayload` maps empty strings to undefined
// so the request body is unchanged.
export const PROFILE_LIMITS = {
  firstName: 100,
  lastName: 100,
  headline: 150,
  bio: 2000,
  location: 120,
  school: 150,
  availability: 60,
  mobility: 120,
} as const;

// EF-CAND-05 — the platform's single salary currency (mirrors the backend
// SALARY_CURRENCY / @IsIn validation).
export const SALARY_CURRENCY = 'MAD';

const bounded = (max: number) =>
  z.string().max(max, { message: `Maximum ${max} caractères` });

// Optional non-negative integer from a text input: '' → undefined, else parsed.
const optionalAmount = z
  .string()
  .refine((v) => v === '' || /^\d{1,9}$/.test(v.trim()), {
    message: 'Montant invalide',
  });

export const profileSchema = z
  .object({
    firstName: bounded(PROFILE_LIMITS.firstName),
    lastName: bounded(PROFILE_LIMITS.lastName),
    headline: bounded(PROFILE_LIMITS.headline),
    bio: bounded(PROFILE_LIMITS.bio),
    location: bounded(PROFILE_LIMITS.location),
    school: bounded(PROFILE_LIMITS.school),
    visibility: z.enum(VISIBILITY_OPTIONS),
    availability: bounded(PROFILE_LIMITS.availability),
    mobility: bounded(PROFILE_LIMITS.mobility),
    salaryMin: optionalAmount,
    salaryMax: optionalAmount,
    salaryVisible: z.boolean(),
  })
  .refine(
    (v) =>
      v.salaryMin === '' ||
      v.salaryMax === '' ||
      Number(v.salaryMin) <= Number(v.salaryMax),
    { message: 'Le minimum dépasse le maximum', path: ['salaryMax'] },
  );

export type ProfileFormValues = z.infer<typeof profileSchema>;

export const EMPTY_PROFILE_FORM: ProfileFormValues = {
  firstName: '',
  lastName: '',
  headline: '',
  bio: '',
  location: '',
  school: '',
  visibility: 'hidden',
  availability: '',
  mobility: '',
  salaryMin: '',
  salaryMax: '',
  salaryVisible: true,
};

export function toUpdatePayload(v: ProfileFormValues): Record<string, unknown> {
  return {
    firstName: v.firstName || undefined,
    lastName: v.lastName || undefined,
    headline: v.headline || undefined,
    bio: v.bio || undefined,
    location: v.location || undefined,
    school: v.school || undefined,
    visibility: v.visibility,
    availability: v.availability || undefined,
    mobility: v.mobility || undefined,
    salaryMin: v.salaryMin === '' ? undefined : Number(v.salaryMin),
    salaryMax: v.salaryMax === '' ? undefined : Number(v.salaryMax),
    salaryCurrency: SALARY_CURRENCY,
    salaryVisible: v.salaryVisible,
  };
}
