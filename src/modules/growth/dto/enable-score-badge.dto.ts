import { IsOptional, IsString, MaxLength } from 'class-validator';

export class EnableScoreBadgeDto {
  // Opt-in only — omit to keep the badge anonymous (EF-GROW-01: no sensitive
  // data by default). Capped so it can't carry a paragraph of PII.
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;
}
