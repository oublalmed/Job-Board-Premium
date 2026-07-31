import { IsEnum } from 'class-validator';
import { SubscriptionPlan } from '../../companies/entities/subscription.entity.js';

export class ChangeSubscriptionPlanDto {
  @IsEnum(SubscriptionPlan)
  plan!: SubscriptionPlan;
}
