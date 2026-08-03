import { ApiProperty } from '@nestjs/swagger';

// Documentation-only — see skill-summary.dto.ts. Mirrors
// ProfileSkillSummary's actual shape (a profile's attached skill,
// joined with the referential Skill for name/category).
export class ProfileSkillSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  skillId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  category!: string | null;

  @ApiProperty({ nullable: true, type: String })
  level!: string | null;
}
