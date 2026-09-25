import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

// EF-EVAL-02 / §5.3 — cumulative behavioural counts reported by the secure-exam
// client. Bounded to keep a tampered client from writing absurd values; they
// are a soft moderation signal, never authoritative.
export class RecordProctoringEventsDto {
  @ApiProperty({ example: 2, minimum: 0, maximum: 10000 })
  @IsInt()
  @Min(0)
  @Max(10000)
  tabSwitches!: number;

  @ApiProperty({ example: 1, minimum: 0, maximum: 10000 })
  @IsInt()
  @Min(0)
  @Max(10000)
  windowBlurs!: number;
}
