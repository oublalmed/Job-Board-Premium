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
import { CandidateProfile } from './candidate-profile.entity.js';

// EF-CAND-07 — structured certifications & projects. Previously only an enum
// value existed with nowhere to store the actual records; this makes each
// certification a first-class, owner-scoped row on the candidate profile.
@Index('IDX_certifications_profile_id', ['profileId'])
@Entity('certifications')
export class Certification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'profile_id' })
  profileId!: string;

  @ManyToOne(() => CandidateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile!: CandidateProfile;

  @Column()
  name!: string;

  @Column()
  issuer!: string;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate!: string;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate!: string | null;

  @Column({ name: 'credential_url', type: 'varchar', nullable: true })
  credentialUrl!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
