import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CandidateProfile } from '../../candidates/entities/candidate-profile.entity.js';
import { Document } from '../../candidates/entities/document.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum SchoolVerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

// One row per candidate (unique on candidateProfileId) — a re-submission
// replaces the previous row rather than accumulating history, mirroring
// how CandidateDocumentService already replaces a candidate's CV on
// re-upload rather than keeping every past version.
@Entity('school_verifications')
export class SchoolVerification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'candidate_profile_id', unique: true })
  candidateProfileId!: string;

  @ManyToOne(() => CandidateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile!: CandidateProfile;

  @Column({ name: 'document_id' })
  documentId!: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document!: Document;

  @Column({
    type: 'enum',
    enum: SchoolVerificationStatus,
    default: SchoolVerificationStatus.PENDING,
  })
  status!: SchoolVerificationStatus;

  @Column({ name: 'ocr_extracted_text', type: 'text', nullable: true })
  ocrExtractedText!: string | null;

  @Column({ name: 'matched_school', type: 'varchar', nullable: true })
  matchedSchool!: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  confidence!: number | null;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer!: User | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'review_note', type: 'text', nullable: true })
  reviewNote!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
