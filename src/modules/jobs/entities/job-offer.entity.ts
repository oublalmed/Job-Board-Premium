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
import { Company } from '../../companies/entities/company.entity.js';

// §3 — a job offer's lifecycle. Recruiter-controlled: draft → published →
// closed (no separate moderation step for now).
export enum JobStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CLOSED = 'closed',
}

// §3.3 — contract type. Mirrors the candidate profile's contractType values,
// plus an internship option.
export enum JobContractType {
  CDI = 'CDI',
  CDD = 'CDD',
  PFE = 'PFE',
  FREELANCE = 'Freelance',
  INTERNSHIP = 'Internship',
}

export enum ExperienceLevel {
  JUNIOR = 'junior',
  MID = 'mid',
  SENIOR = 'senior',
  LEAD = 'lead',
}

@Entity('job_offers')
export class JobOffer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id' })
  @Index()
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  // The recruiter (user id) who created the offer.
  @Column({ name: 'created_by' })
  createdBy!: string;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', nullable: true })
  location!: string | null;

  @Column({
    name: 'contract_type',
    type: 'enum',
    enum: JobContractType,
    nullable: true,
  })
  contractType!: JobContractType | null;

  @Column({
    name: 'experience_level',
    type: 'enum',
    enum: ExperienceLevel,
    nullable: true,
  })
  experienceLevel!: ExperienceLevel | null;

  // Required skills, stored as a comma-separated list (simple-array).
  @Column({ type: 'simple-array', nullable: true })
  skills!: string[] | null;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.DRAFT })
  @Index()
  status!: JobStatus;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'deadline', type: 'timestamptz', nullable: true })
  deadline!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
