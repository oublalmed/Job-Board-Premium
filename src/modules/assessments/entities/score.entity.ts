import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Assessment } from './assessment.entity.js';
import type { DomainFeedbackEntry } from '../../../ports/scoring.port.js';

export enum PlagiarismVerdict {
  CLEAN = 'clean',
  SUSPECTED = 'suspected',
  CONFIRMED = 'confirmed',
}

@Entity('scores')
export class Score {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'assessment_id', unique: true })
  assessmentId!: string;

  @OneToOne(() => Assessment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_id' })
  assessment!: Assessment;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  value!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  percentile!: number | null;

  @Column({ name: 'bareme_version' })
  baremeVersion!: string;

  @Column({ name: 'test_version' })
  testVersion!: string;

  @Column({
    name: 'plagiarism_verdict',
    type: 'enum',
    enum: PlagiarismVerdict,
    default: PlagiarismVerdict.CLEAN,
  })
  plagiarismVerdict!: PlagiarismVerdict;

  @Column({ name: 'details', type: 'jsonb', nullable: true })
  details!: Record<string, unknown> | null;

  // Lot 7 (EF-REM-01) — per-domain strengths/weaknesses, kept as a
  // dedicated typed column rather than folded into `details` above: the
  // "never leak a question/answer" guarantee needs to be structural (the
  // type only has domain+level), not a discipline someone has to remember
  // when writing into a free-form jsonb bag.
  @Column({ name: 'domain_feedback', type: 'jsonb', nullable: true })
  domainFeedback!: DomainFeedbackEntry[] | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
