import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { JobOffer } from './job-offer.entity.js';
import { CandidateProfile } from '../../candidates/entities/candidate-profile.entity.js';

// §3.4 — the application workflow.
export enum ApplicationStatus {
  APPLIED = 'applied',
  UNDER_REVIEW = 'under_review',
  SHORTLISTED = 'shortlisted',
  INTERVIEW = 'interview',
  REJECTED = 'rejected',
  ACCEPTED = 'accepted',
}

@Entity('job_applications')
@Unique('UQ_job_applications_offer_candidate', ['jobOfferId', 'candidateId'])
export class JobApplication {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'job_offer_id' })
  @Index()
  jobOfferId!: string;

  @ManyToOne(() => JobOffer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_offer_id' })
  jobOffer!: JobOffer;

  // The applicant (user id).
  @Column({ name: 'candidate_id' })
  candidateId!: string;

  // Denormalised profile FK so the recruiter view can join to the profile
  // (name, headline) without a second lookup.
  @Column({ name: 'candidate_profile_id' })
  candidateProfileId!: string;

  @ManyToOne(() => CandidateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile!: CandidateProfile;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.APPLIED,
  })
  status!: ApplicationStatus;

  @Column({ name: 'cover_letter', type: 'text', nullable: true })
  coverLetter!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
