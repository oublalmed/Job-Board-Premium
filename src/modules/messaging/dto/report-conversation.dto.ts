import { IsString, MinLength, MaxLength } from 'class-validator';

// EF-MSG-05 — reason a participant is flagging a conversation for abuse.
export class ReportConversationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}
