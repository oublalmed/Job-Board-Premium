import type {
  ApplicationStatus,
  JobStatus,
} from './queries';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'secondary'
  | 'outline';

// Offer lifecycle → i18n key + badge colour.
export const JOB_STATUS_BADGE: Record<
  JobStatus,
  { variant: BadgeVariant; key: string }
> = {
  draft: { variant: 'secondary', key: 'jobs.status.draft' },
  published: { variant: 'success', key: 'jobs.status.published' },
  closed: { variant: 'outline', key: 'jobs.status.closed' },
};

// Application workflow → i18n key + badge colour.
export const APPLICATION_STATUS_BADGE: Record<
  ApplicationStatus,
  { variant: BadgeVariant; key: string }
> = {
  applied: { variant: 'secondary', key: 'jobs.appStatus.applied' },
  under_review: { variant: 'default', key: 'jobs.appStatus.under_review' },
  shortlisted: { variant: 'warning', key: 'jobs.appStatus.shortlisted' },
  interview: { variant: 'default', key: 'jobs.appStatus.interview' },
  accepted: { variant: 'success', key: 'jobs.appStatus.accepted' },
  rejected: { variant: 'destructive', key: 'jobs.appStatus.rejected' },
};

export function contractTypeKey(value: string): string {
  return `jobs.contract.${value}`;
}

export function experienceLevelKey(value: string): string {
  return `jobs.experience.${value}`;
}
