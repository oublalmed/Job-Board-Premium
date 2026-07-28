import { IsUUID } from 'class-validator';

export class ResumeAssessmentDto {
  @IsUUID()
  assessmentId!: string;

  @IsUUID()
  resumeToken!: string;
}
