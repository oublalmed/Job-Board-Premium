import { ApiProperty } from '@nestjs/swagger';

// Documentation-only — see assessments/dto/specialty-summary.dto.ts for
// the same pattern. Mirrors SkillSummary's actual shape.
export class SkillSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  category!: string | null;
}
