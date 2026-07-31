import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { TrialCode } from './trial-code.entity.js';
import { Company } from '../../companies/entities/company.entity.js';

export const TRIAL_CODE_REDEMPTION_COMPANY_UNIQUE_CONSTRAINT =
  'UQ_trial_code_redemptions_company_id';

// companyId is UNIQUE, not composite with trialCodeId — a company can
// redeem AT MOST ONE trial code, ever. This is the anti-abuse rule: not
// "can't reuse the same code twice" but "can't stack trials at all",
// enforced structurally (23505 on redemption, discriminated via
// isUniqueViolation), never a read-then-write existence check. Named
// explicitly (not TypeORM's auto-generated hash) so
// TrialCodeRedemptionService can discriminate this specific constraint —
// same reasoning as PROCESSED_WEBHOOK_EVENT_UNIQUE_CONSTRAINT.
@Entity('trial_code_redemptions')
@Index(TRIAL_CODE_REDEMPTION_COMPANY_UNIQUE_CONSTRAINT, ['companyId'], {
  unique: true,
})
export class TrialCodeRedemption {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trial_code_id' })
  trialCodeId!: string;

  @ManyToOne(() => TrialCode, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'trial_code_id' })
  trialCode!: TrialCode;

  @Column({ name: 'company_id' })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @CreateDateColumn({ name: 'redeemed_at', type: 'timestamptz' })
  redeemedAt!: Date;

  // Set by TrialConversionService when the company's trial later converts
  // to a real paid subscription (PaymentWebhookService.activateSubscription)
  // — null until then. Not a status enum: "converted or not" is fully
  // captured by this single nullable timestamp.
  @Column({ name: 'converted_at', type: 'timestamptz', nullable: true })
  convertedAt!: Date | null;
}
