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

  // The overall composite (0-100) — computed from technicalScore/
  // psychotechnicalScore below when both are present (weighted 60/40 by
  // default, see webhook.service.ts), otherwise falls back to the
  // provider's own already-composited score/maxScore for providers that
  // don't split their result into the two components.
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  value!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  percentile!: number | null;

  // Nullable because pre-existing scores (before this composition) never
  // had a technique/psychotechnique split — only new webhook payloads
  // populate these.
  @Column({ name: 'technical_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  technicalScore!: number | null;

  @Column({ name: 'psychotechnical_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  psychotechnicalScore!: number | null;

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
