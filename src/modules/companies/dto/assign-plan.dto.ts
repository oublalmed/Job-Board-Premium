import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { SubscriptionPlan } from '../entities/subscription.entity.js';

// Admin assigns a pack to a recruiter's company, per their contract. The
// contact quota is optional: for STARTER/GROWTH/SCALE it defaults to the
// plan's configured allowance; for ENTERPRISE (negotiated per contract) an
// explicit quota is required (the service enforces this).
export class AssignPlanDto {
  @IsUUID()
  companyId!: string;

  @IsEnum(SubscriptionPlan)
  plan!: SubscriptionPlan;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  contactQuota?: number;
}
