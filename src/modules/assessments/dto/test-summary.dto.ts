import { ApiProperty } from '@nestjs/swagger';

// Documentation-only — see specialty-summary.dto.ts. Mirrors
// TestSummary's actual shape (deliberately no provider/externalTestId).
export class TestSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  specialtyId!: string;

  @ApiProperty()
  durationMinutes!: number;
}
