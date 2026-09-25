import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

export enum ProfileVisibility {
  PUBLIC = 'public',
  RECRUITERS_ONLY = 'recruiters_only',
  HIDDEN = 'hidden',
}

// EF-ADM-01 — admin-owned moderation state, distinct from the candidate's own
// `visibility` choice. A SUSPENDED profile is excluded from the CVthèque
// regardless of what the candidate sets, and cannot be un-suspended by them.
export enum ProfileModerationStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

// ENF-01 — every CVthèque read gates on `indexed_in_cvtheque = true AND
// visibility IN (...)` (see SearchService). This composite index keeps that
// hottest predicate off a sequential scan as the profile table grows.
@Index('IDX_candidate_profiles_indexed_visibility', [
  'indexedInCvtheque',
  'visibility',
])
@Entity('candidate_profiles')
export class CandidateProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', unique: true })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'first_name', type: 'varchar', nullable: true })
  firstName!: string | null;

  @Column({ name: 'last_name', type: 'varchar', nullable: true })
  lastName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  headline!: string | null;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ type: 'varchar', nullable: true })
  location!: string | null;

  @Column({ type: 'varchar', nullable: true })
  school!: string | null;

  // Set true only by SchoolVerificationService.approve() on an
  // admin/moderator decision — never writable via the candidate's own
  // profile update endpoint, since it's a claim about someone else's
  // review, not the candidate's own data.
  @Column({ name: 'school_verified', default: false })
  schoolVerified!: boolean;

  @Column({
    type: 'enum',
    enum: ProfileVisibility,
    default: ProfileVisibility.HIDDEN,
  })
  visibility!: ProfileVisibility;

  // EF-ADM-01 — admin moderation status; default ACTIVE. SUSPENDED profiles are
  // filtered out of every CVthèque read (see SearchService).
  @Column({
    name: 'moderation_status',
    type: 'enum',
    enum: ProfileModerationStatus,
    default: ProfileModerationStatus.ACTIVE,
  })
  moderationStatus!: ProfileModerationStatus;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  completeness!: number;

  @Column({ name: 'indexed_in_cvtheque', default: false })
  indexedInCvtheque!: boolean;

  // EF-CAND-05 — availability / mobility / salary expectation. Salary is a
  // range in MAD (the platform's single currency), maskable by the candidate:
  // when `salaryVisible` is false the range is withheld from recruiter-facing
  // projections. (Re-introduced in V0.4 after the Aug pivot had removed these
  // fields; the offers module stays removed — these live on the profile.)
  @Column({ type: 'varchar', nullable: true })
  availability!: string | null;

  @Column({ type: 'varchar', nullable: true })
  mobility!: string | null;

  @Column({ name: 'salary_min', type: 'int', nullable: true })
  salaryMin!: number | null;

  @Column({ name: 'salary_max', type: 'int', nullable: true })
  salaryMax!: number | null;

  @Column({ name: 'salary_currency', type: 'varchar', length: 3, default: 'MAD' })
  salaryCurrency!: string;

  @Column({ name: 'salary_visible', type: 'boolean', default: true })
  salaryVisible!: boolean;

  @Column({ default: false })
  featured!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
