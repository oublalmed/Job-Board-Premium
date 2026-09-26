import { IsObject } from 'class-validator';

// Candidate's exam answers: a map of questionId -> free-text answer. Values are
// graded server-side (open-ended questions); unknown/missing entries count as
// unanswered.
export class SubmitExamDto {
  @IsObject()
  answers!: Record<string, string>;
}
