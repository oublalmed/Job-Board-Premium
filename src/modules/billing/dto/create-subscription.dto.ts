import { IsEnum, IsUrl } from 'class-validator';
import { SubscriptionPlan } from '../../companies/entities/subscription.entity.js';

export class CreateSubscriptionDto {
  @IsEnum(SubscriptionPlan)
  plan!: SubscriptionPlan;

  @IsUrl({ require_tld: false })
  successUrl!: string;

  @IsUrl({ require_tld: false })
  cancelUrl!: string;
}
