import { IsUUID } from 'class-validator';

export class StartAssessmentDto {
  @IsUUID()
  testId!: string;
}
