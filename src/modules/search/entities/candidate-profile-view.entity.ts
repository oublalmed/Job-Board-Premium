import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { CandidateProfile } from '../../candidates/entities/candidate-profile.entity.js';
import { Company } from '../../companies/entities/company.entity.js';

// EF-GROW-04 — an unconditional audit trail: one row per view, every time,
// independent of the anti-spam notification claim (ProfileViewCooldown).
// Never deduplicated or deleted — the notification decision is a separate
// concern from what actually happened.
@Entity('candidate_profile_views')
export class CandidateProfileView {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'recruiter_id' })
  recruiterId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recruiter_id' })
  recruiter!: User;

  @Column({ name: 'candidate_profile_id' })
  candidateProfileId!: string;

  @ManyToOne(() => CandidateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile!: CandidateProfile;

  @Column({ name: 'company_id' })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @CreateDateColumn({ name: 'viewed_at', type: 'timestamptz' })
  viewedAt!: Date;
}
