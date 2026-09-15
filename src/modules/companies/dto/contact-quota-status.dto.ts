import { ApiProperty } from '@nestjs/swagger';
import {
  SubscriptionPlan,
  SubscriptionStatus,
} from '../entities/subscription.entity.js';

// EF-RECR-05 — recruiter-facing contact-quota snapshot.
export class ContactQuotaStatusDto {
  @ApiProperty({ description: 'False when there is no active subscription.' })
  active!: boolean;

  @ApiProperty({ enum: SubscriptionPlan, nullable: true })
  plan!: SubscriptionPlan | null;

  @ApiProperty({ enum: SubscriptionStatus, nullable: true })
  status!: SubscriptionStatus | null;

  @ApiProperty({ nullable: true, description: 'Monthly contact allowance.' })
  contactQuota!: number | null;

  @ApiProperty({ nullable: true })
  contactsUsed!: number | null;

  @ApiProperty({
    nullable: true,
    description: 'Remaining contacts this cycle.',
  })
  contactsRemaining!: number | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  quotaResetAt!: Date | null;
}
