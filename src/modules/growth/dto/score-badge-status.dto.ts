import { ApiProperty } from '@nestjs/swagger';
import { PublicBadgeDto } from './public-badge.dto.js';

// The candidate's own view of their badge: whether a badge row exists, the
// opt-in state, the public token (to build the share URL), a preview of what
// the public page shows, and whether the candidate even has a score to
// showcase (drives the enable button's availability).
export class ScoreBadgeStatusDto {
  @ApiProperty()
  hasBadge!: boolean;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ nullable: true })
  token!: string | null;

  @ApiProperty({ type: PublicBadgeDto, nullable: true })
  badge!: PublicBadgeDto | null;

  @ApiProperty()
  hasScore!: boolean;
}
