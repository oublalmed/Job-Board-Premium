import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Role } from '../../../common/enums/role.enum.js';
import { RefreshToken } from './refresh-token.entity.js';

export enum UserStatus {
  PENDING_VERIFICATION = 'pending_verification',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  @Index()
  email!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({
    type: 'enum',
    enum: Role,
    array: true,
    default: [Role.CANDIDATE],
  })
  roles!: Role[];

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING_VERIFICATION,
  })
  status!: UserStatus;

  @Column({ name: 'email_verified', default: false })
  emailVerified!: boolean;

  @Column({ name: 'email_verification_token', type: 'varchar', nullable: true })
  emailVerificationToken!: string | null;

  @Column({
    name: 'email_verification_expires',
    type: 'timestamptz',
    nullable: true,
  })
  emailVerificationExpires!: Date | null;

  // EF-CAND-01 — password reset. Stores a SHA-256 HASH of the emailed token
  // (never the raw token), so a leaked DB row cannot be used to reset a
  // password. Cleared on use and on expiry.
  @Column({ name: 'password_reset_token', type: 'varchar', nullable: true })
  passwordResetToken!: string | null;

  @Column({
    name: 'password_reset_expires',
    type: 'timestamptz',
    nullable: true,
  })
  passwordResetExpires!: Date | null;

  // ENF-06 — MFA/TOTP. `mfaSecret` holds the base32 shared secret encrypted
  // at rest (AES-256-GCM, see secret-box.ts); it is set at enrollment start
  // and `mfaEnabled` only flips true once the user proves possession by
  // entering a valid code. Backup codes are stored argon2-hashed (never
  // plaintext), same treatment as passwords, and consumed one-time.
  @Column({ name: 'mfa_enabled', default: false })
  mfaEnabled!: boolean;

  @Column({ name: 'mfa_secret', type: 'text', nullable: true })
  mfaSecret!: string | null;

  @Column({ name: 'mfa_backup_codes', type: 'jsonb', nullable: true })
  mfaBackupCodes!: string[] | null;

  // ENF-12 (CNDP/RGPD) — timestamp of the privacy-policy consent captured at
  // registration. Nullable because accounts created before this existed have
  // no recorded consent; new sign-ups always set it.
  @Column({ name: 'consent_at', type: 'timestamptz', nullable: true })
  consentAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens!: RefreshToken[];
}
