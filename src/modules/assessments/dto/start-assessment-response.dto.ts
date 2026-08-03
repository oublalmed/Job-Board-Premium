import { ApiProperty } from '@nestjs/swagger';
import { Assessment } from '../entities/assessment.entity.js';

// Documentation-only — mirrors AssessmentService.startAssessment/
// resumeAssessment's actual inline return shape ({ assessment,
// assessmentUrl }). Assessment itself already reflects correctly (real
// @Entity() class) — only the wrapping object literal was unreflectable.
export class StartAssessmentResponseDto {
  @ApiProperty({ type: Assessment })
  assessment!: Assessment;

  @ApiProperty()
  assessmentUrl!: string;
}
