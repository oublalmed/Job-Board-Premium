import { ApiProperty } from '@nestjs/swagger';

export type BadgeLevel = 'expert' | 'advanced' | 'intermediate' | 'beginner';

export const BADGE_LEVELS: BadgeLevel[] = [
  'expert',
  'advanced',
  'intermediate',
  'beginner',
];

// EF-GROW-01 "page vitrine … sans données sensibles": deliberately minimal.
// The score value, its percentile, the specialty, a qualitative level, the
// issue date, and an opt-in display name — no email, no per-domain feedback,
// no assessment/answer data.
export class PublicBadgeDto {
  @ApiProperty()
  scoreValue!: number;

  @ApiProperty({ nullable: true })
  percentile!: number | null;

  @ApiProperty()
  specialtyName!: string;

  @ApiProperty({ enum: BADGE_LEVELS })
  level!: BadgeLevel;

  @ApiProperty()
  issuedAt!: string;

  @ApiProperty({ nullable: true })
  displayName!: string | null;
}
