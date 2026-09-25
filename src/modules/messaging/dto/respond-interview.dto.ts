import { IsIn } from 'class-validator';
import { InterviewStatus } from '../entities/interview.entity.js';

// EF-MSG-04 — the transitions a participant may request on a PROPOSED
// interview. The authorization rule (counterpart accepts/declines, proposer
// cancels) is enforced in the service, not here.
export type InterviewResponse =
  | InterviewStatus.ACCEPTED
  | InterviewStatus.DECLINED
  | InterviewStatus.CANCELLED;

const RESPONSE_VALUES: InterviewResponse[] = [
  InterviewStatus.ACCEPTED,
  InterviewStatus.DECLINED,
  InterviewStatus.CANCELLED,
];

export class RespondInterviewDto {
  @IsIn(RESPONSE_VALUES)
  status!: InterviewResponse;
}
