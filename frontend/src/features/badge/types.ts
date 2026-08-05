export type BadgeLevel = 'expert' | 'advanced' | 'intermediate' | 'beginner';

export interface PublicBadge {
  scoreValue: number;
  percentile: number | null;
  specialtyName: string;
  level: BadgeLevel;
  issuedAt: string;
  displayName: string | null;
}

export interface BadgeStatus {
  hasBadge: boolean;
  enabled: boolean;
  token: string | null;
  badge: PublicBadge | null;
  hasScore: boolean;
}
