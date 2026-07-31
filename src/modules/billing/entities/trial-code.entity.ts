import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { SubscriptionPlan } from '../../companies/entities/subscription.entity.js';

export enum TrialCodeStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
}

// EF-GROW-03 / US-GROW-03 — an admin-managed promo code, not a code baked
// into env config. usedCount is incremented via an atomic conditional
// UPDATE (WHERE used_count < max_uses), never a read-then-write — see
// TrialCodeRedemptionService.
@Entity('trial_codes')
export class TrialCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  code!: string;

  @Column({ type: 'enum', enum: SubscriptionPlan })
  plan!: SubscriptionPlan;

  @Column({ name: 'trial_duration_days', type: 'integer' })
  trialDurationDays!: number;

  @Column({ name: 'max_uses', type: 'integer' })
  maxUses!: number;

  @Column({ name: 'used_count', type: 'integer', default: 0 })
  usedCount!: number;

  @Column({
    type: 'enum',
    enum: TrialCodeStatus,
    default: TrialCodeStatus.ACTIVE,
  })
  status!: TrialCodeStatus;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
