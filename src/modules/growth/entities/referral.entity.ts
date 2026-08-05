import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

// Lot 7 (EF-GROW-02) — a candidate's referral link. One per referrer
// (unique user id); `code` is the short, unguessable token embedded in the
// share URL. Conversions are tracked separately (ReferralConversion).
@Entity('referrals')
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'referrer_user_id', unique: true })
  referrerUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referrer_user_id' })
  referrer!: User;

  @Column({ unique: true })
  code!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
