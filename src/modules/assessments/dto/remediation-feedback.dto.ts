import { ApiProperty } from '@nestjs/swagger';
import type { DomainFeedbackLevel } from '../../../ports/scoring.port.js';

// Documentation-only — mirrors RemediationFeedback (remediation.
// service.ts). DomainFeedbackEntryDto is deliberately closed to exactly
// {domain, level} — the same structural guard as the port type itself
// (ScoringProvider, Lot 7): it must stay structurally incapable of
// carrying a question/answer from the test bank, not just as a matter
// of discipline.
export class DomainFeedbackEntryDto {
  @ApiProperty()
  domain!: string;

  @ApiProperty({ enum: ['weak', 'medium', 'strong'] })
  level!: DomainFeedbackLevel;
}

export class RemediationResourceDto {
  @ApiProperty()
  title!: string;

  @ApiProperty()
  url!: string;
}

export class RemediationFeedbackDto {
  @ApiProperty()
  scoreValue!: number;

  @ApiProperty()
  indexationThresholdMet!: boolean;

  @ApiProperty({ type: DomainFeedbackEntryDto, isArray: true })
  domainFeedback!: DomainFeedbackEntryDto[];

  @ApiProperty({ type: RemediationResourceDto, isArray: true })
  resources!: RemediationResourceDto[];

  @ApiProperty({ nullable: true, type: String })
  reEligibleAt!: string | null;
}
