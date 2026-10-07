import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Company } from './company.entity.js';

export enum RecruiterInvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REVOKED = 'revoked',
}

// A company_admin invites a teammate by email to join their company as a
// recruiter. The raw token is emailed; only its SHA-256 hash is stored. On
// accept, the invitee sets a password — their recruiter account is created
// (scoped to the company) or an existing account is attached.
@Entity('recruiter_invitations')
export class RecruiterInvitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id' })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Index()
  @Column()
  email!: string;

  @Column({ name: 'token_hash' })
  tokenHash!: string;

  @Column({ type: 'varchar', nullable: true })
  position!: string | null;

  @Column({
    type: 'enum',
    enum: RecruiterInvitationStatus,
    default: RecruiterInvitationStatus.PENDING,
  })
  status!: RecruiterInvitationStatus;

  @Column({ name: 'invited_by_id' })
  invitedById!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invited_by_id' })
  invitedBy!: User | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
