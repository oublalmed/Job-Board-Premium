import { IsObject } from 'class-validator';

// Candidate's exam answers: a map of questionId -> chosen option index (QCM).
// Values are graded server-side; unknown/missing entries count as wrong.
export class SubmitExamDto {
  @IsObject()
  answers!: Record<string, number>;
}
