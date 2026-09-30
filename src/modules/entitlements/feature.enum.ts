// §10 — centralized feature catalogue. A capability is referenced by this enum
// everywhere (backend guards, services, frontend gating), never by a raw
// `plan === 'premium'` check (§22 rule #5). Which plan grants which feature is
// data (entitlements.matrix.ts), not code branches.
export enum Feature {
  CV_DATABASE = 'cv_database',
  CANDIDATE_SEARCH = 'candidate_search',
  PROFILE_FILTER = 'profile_filter',
  SCHOOL_FILTER = 'school_filter',
  SCORE_SORT = 'score_sort',
  EVALUATIONS = 'evaluations',
  ADVANCED_EVALUATIONS = 'advanced_evaluations',
  JOBS = 'jobs',
  APPLICATIONS = 'applications',
  SHORTLIST = 'shortlist',
  ANTI_CHEAT = 'anti_cheat',
  BASIC_ANALYTICS = 'basic_analytics',
  ADVANCED_ANALYTICS = 'advanced_analytics',
  EXPORT_CANDIDATES = 'export_candidates',
  API_ACCESS = 'api_access',
  MULTI_USER = 'multi_user',
  PRIORITY_SUPPORT = 'priority_support',
}

// §11 — quantitative limits are SEPARATE from feature flags, so pricing/limits
// can change without touching the permission system. A value of `null` means
// unlimited. Contact quota is deliberately NOT here: it is per-subscription
// (subscription.contactQuota, admin-set) and already has its own system
// (ContactQuotaService) — duplicating it would violate §16.
export enum LimitKey {
  MAX_EVALUATIONS_MONTH = 'max_evaluations_month',
  MAX_USERS = 'max_users',
  MAX_JOB_POSTS = 'max_job_posts',
  MAX_EXPORTS_MONTH = 'max_exports_month',
}

export type Limits = Record<LimitKey, number | null>;
