import { IsObject } from 'class-validator';

// Candidate's exam answers: a map of questionId -> chosen option index. The
// values are validated (and coerced) during grading; unknown/missing entries
// are simply treated as wrong.
export class SubmitExamDto {
  @IsObject()
  answers!: Record<string, number>;
}
