import { z } from 'zod';

export const VISIBILITY_OPTIONS = ['public', 'recruiters_only', 'hidden'] as const;

// Mirrors the backend UpdateProfileDto: every field optional, visibility a
// fixed enum. Deliberately NO arbitrary max-lengths — the backend owns the
// real bounds, and inventing client limits could reject payloads the API
// would accept, which would be a behavior change. RHF keeps fields as
// controlled strings; `toUpdatePayload` reproduces the original page's
// exact empty-string -> undefined mapping so the request body is identical.
export const profileSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  headline: z.string(),
  bio: z.string(),
  location: z.string(),
  school: z.string(),
  visibility: z.enum(VISIBILITY_OPTIONS),
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
  };
}
