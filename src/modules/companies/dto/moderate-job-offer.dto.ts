import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ModerationDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
}

export class ModerateJobOfferDto {
  @IsEnum(ModerationDecision)
  decision!: ModerationDecision;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
