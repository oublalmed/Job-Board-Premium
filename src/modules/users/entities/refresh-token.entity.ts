import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity.js';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'token_hash', unique: true })
  @Index()
  tokenHash!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ default: false })
  revoked!: boolean;

  // ENF-06 — whether the session that minted this token satisfied MFA. Threaded
  // through refresh rotation so a step-up authentication survives token refresh
  // and StaffMfaGuard keeps trusting the session without a re-login.
  @Column({ name: 'mfa_authenticated', default: false })
  mfaAuthenticated!: boolean;

  @Column({ name: 'replaced_by', type: 'varchar', nullable: true })
  replacedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
