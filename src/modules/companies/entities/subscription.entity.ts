import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Company } from './company.entity.js';

export enum SubscriptionPlan {
  STARTER = 'starter',
  GROWTH = 'growth',
  SCALE = 'scale',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

// Database-level twin of the "at most one active subscription per company"
// invariant already enforced in application code by
// ContactQuotaService.resolveActiveSubscriptionId (which throws
// MultipleActiveSubscriptionsException — see PROGRESS.md / ADR-0002). A
// partial unique index rather than a plain UNIQUE(company_id): terminal
// rows (CANCELLED, EXPIRED) must be allowed to accumulate per company
// (resubscriptions create new rows), only TRIAL/ACTIVE are mutually
// exclusive.
@Entity('subscriptions')
@Index('UQ_subscriptions_company_active', ['companyId'], {
  unique: true,
  where: `status IN ('trial', 'active')`,
})
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id' })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ type: 'enum', enum: SubscriptionPlan })
  plan!: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.TRIAL,
  })
  status!: SubscriptionStatus;

  @Column({ name: 'external_subscription_id', type: 'varchar', nullable: true })
  externalSubscriptionId!: string | null;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt!: Date | null;

  @Column({ name: 'contact_quota', type: 'integer' })
  contactQuota!: number;

  @Column({ name: 'contacts_used', type: 'integer', default: 0 })
  contactsUsed!: number;

  @Column({ name: 'quota_reset_at', type: 'timestamptz', nullable: true })
  quotaResetAt!: Date | null;

  // Set the moment a subscription first goes PAST_DUE (invoice.payment_failed
  // while ACTIVE), cleared on the next successful payment (back to ACTIVE)
  // or on cancellation. NOT overwritten by later Stripe retry failures on
  // the same subscription — the grace-period deadline (Lot 6D commit 3)
  // is measured from the first failure, not the most recent retry, or
  // Stripe's own multi-week retry calendar would keep extending it.
  @Column({ name: 'past_due_since', type: 'timestamptz', nullable: true })
  pastDueSince!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
