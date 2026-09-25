import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { InterviewMode } from '../entities/interview.entity.js';

// EF-MSG-04 — propose an interview slot inside a conversation. The scheduled
// time must be a valid ISO-8601 instant; the "must be in the future" rule is
// enforced in the service (it needs the request clock, not a static decorator).
export class ProposeInterviewDto {
  @IsEnum(InterviewMode)
  mode!: InterviewMode;

  @IsISO8601()
  scheduledAt!: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
