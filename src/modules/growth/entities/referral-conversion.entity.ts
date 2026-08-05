import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Referral } from './referral.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum ReferralConversionStatus {
  // The referee signed up via the link…
  SIGNED_UP = 'signed_up',
  // …and later verified their email (the tracked "conversion").
  CONVERTED = 'converted',
}

// Lot 7 (EF-GROW-02) — one row per referred user (unique referee id), so a
// person can only ever be attributed to a single referrer, once.
@Entity('referral_conversions')
export class ReferralConversion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'referral_id' })
  referralId!: string;

  @ManyToOne(() => Referral, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referral_id' })
  referral!: Referral;

  @Column({ name: 'referee_user_id', unique: true })
  refereeUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referee_user_id' })
  referee!: User;

  @Column({
    type: 'enum',
    enum: ReferralConversionStatus,
    default: ReferralConversionStatus.SIGNED_UP,
  })
  status!: ReferralConversionStatus;

  @Column({ name: 'converted_at', type: 'timestamptz', nullable: true })
  convertedAt!: Date | null;

  @CreateDateColumn({ name: 'signed_up_at', type: 'timestamptz' })
  signedUpAt!: Date;
}
