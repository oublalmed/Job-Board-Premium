import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsUrl, MaxLength } from 'class-validator';

// EF-CAND-09 — toggle whether the candidate has completed a remediation
// resource, identified by its URL (the stable key in the resource table).
export class UpdateRemediationProgressDto {
  @ApiProperty({ example: 'https://sqlbolt.com/' })
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  url!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  completed!: boolean;
}
