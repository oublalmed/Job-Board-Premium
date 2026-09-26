import { z } from 'zod';

export const VISIBILITY_OPTIONS = ['public', 'recruiters_only', 'hidden'] as const;

// Desired contract type. Canonical human-readable values, stored as-is so
// existing text displays render them without a lookup.
export const CONTRACT_OPTIONS = ['CDI', 'CDD', 'PFE', 'Freelance'] as const;

// Dropdown option sets for location & availability (Morocco-centric). Values
// are the display labels themselves, keeping stored data human-readable.
export const LOCATION_OPTIONS = [
  'Casablanca',
  'Rabat',
  'Marrakech',
  'Tanger',
  'Fès',
  'Agadir',
  'Meknès',
  'Oujda',
  'Kénitra',
  'Tétouan',
  'Télétravail',
  'Autre',
] as const;

export const AVAILABILITY_OPTIONS = [
  'Immédiate',
  'Sous 1 mois',
  'Sous 3 mois',
  'Sous 6 mois',
] as const;

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

const bounded = (max: number) =>
  z.string().max(max, { message: `Maximum ${max} caractères` });

export const profileSchema = z.object({
  firstName: bounded(PROFILE_LIMITS.firstName),
  lastName: bounded(PROFILE_LIMITS.lastName),
  headline: bounded(PROFILE_LIMITS.headline),
  bio: bounded(PROFILE_LIMITS.bio),
  // Location & availability are chosen from a fixed list in the UI, but kept as
  // bounded strings here so any legacy free-text value still validates.
  location: bounded(PROFILE_LIMITS.location),
  school: bounded(PROFILE_LIMITS.school),
  visibility: z.enum(VISIBILITY_OPTIONS),
  availability: bounded(PROFILE_LIMITS.availability),
  // '' = not specified; otherwise one of the contract options.
  contractType: z.enum(['', ...CONTRACT_OPTIONS]),
  mobility: bounded(PROFILE_LIMITS.mobility),
});

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
  contractType: '',
  mobility: '',
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
    contractType: v.contractType || undefined,
    mobility: v.mobility || undefined,
  };
}
