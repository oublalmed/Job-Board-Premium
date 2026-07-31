import { IsEnum, IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';
import { SubscriptionPlan } from '../../companies/entities/subscription.entity.js';

export class CreateTrialCodeDto {
  @IsString()
  @MinLength(4)
  code!: string;

  @IsEnum(SubscriptionPlan)
  plan!: SubscriptionPlan;

  @IsInt()
  @IsPositive()
  trialDurationDays!: number;

  @IsInt()
  @IsPositive()
  maxUses!: number;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}
