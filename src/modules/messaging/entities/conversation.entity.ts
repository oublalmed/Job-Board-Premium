import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { CandidateProfile } from '../../candidates/entities/candidate-profile.entity.js';
import { Company } from '../../companies/entities/company.entity.js';

export enum ConversationStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

// One thread per (candidate, company) pair — enforced by the DB, not by a
// prior findOne check. ConversationService relies on a violation of this
// constraint to detect "already open" and roll back the quota decrement
// that was attempted in the same transaction (see openConversation).
@Entity('conversations')
@Unique(['candidateId', 'companyId'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'candidate_id' })
  candidateId!: string;

  @ManyToOne(() => CandidateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate!: CandidateProfile;

  // The recruiter (User.id) who opened the thread — not a Recruiter row FK,
  // consistent with JobOffer.createdBy / ShortlistEntry.addedBy elsewhere
  // in this module.
  @Column({ name: 'recruiter_id' })
  recruiterId!: string;

  @Column({ name: 'company_id' })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({
    type: 'enum',
    enum: ConversationStatus,
    default: ConversationStatus.OPEN,
  })
  status!: ConversationStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
