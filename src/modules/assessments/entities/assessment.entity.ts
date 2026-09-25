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
import { User } from '../../users/entities/user.entity.js';
import { Test } from './test.entity.js';

export enum AssessmentStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  INCIDENT = 'incident',
}

@Entity('assessments')
export class Assessment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'candidate_id' })
  candidateId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate!: User;

  @Column({ name: 'test_id' })
  testId!: string;

  @ManyToOne(() => Test, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_id' })
  test!: Test;

  @Column({ name: 'external_assessment_id', type: 'varchar', nullable: true })
  externalAssessmentId!: string | null;

  @Column({
    type: 'enum',
    enum: AssessmentStatus,
    default: AssessmentStatus.PENDING,
  })
  status!: AssessmentStatus;

  @Column({ name: 'resume_token', type: 'uuid', nullable: true })
  resumeToken!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  // Lot 7 (EF-REM-03) — set once the J-90 cooldown-expiry notification has
  // actually been sent for this assessment. This is the claim marker: the
  // sweep only ever notifies a row where this is still NULL, via an atomic
  // conditional UPDATE (WHERE ... AND cooldown_notified_at IS NULL), never
  // a read-then-write — see RemediationNotificationService.
  @Column({ name: 'cooldown_notified_at', type: 'timestamptz', nullable: true })
  cooldownNotifiedAt!: Date | null;

  // §5.3 anti-cheat (multi-account layer) — the client IP and an opaque device
  // fingerprint captured at start, plus a review flag raised when the same
  // device/IP was used by a *different* candidate inside the detection window.
  // This is a signal for moderation (audited, surfaced in the admin trail),
  // not a hard block: shared NAT/corporate IPs would otherwise false-positive.
  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  @Index()
  ipAddress!: string | null;

  @Column({ name: 'device_fingerprint', type: 'varchar', nullable: true })
  @Index()
  deviceFingerprint!: string | null;

  @Column({ name: 'multi_account_flagged', type: 'boolean', default: false })
  multiAccountFlagged!: boolean;

  // EF-EVAL-02 / §5.3 behavioural-signals layer — cumulative counts reported by
  // the secure-exam client during the attempt, and a review flag raised when
  // they cross the configured threshold. First-party (no external proctoring
  // vendor); a soft moderation signal, never a hard block.
  @Column({ name: 'tab_switch_count', type: 'int', default: 0 })
  tabSwitchCount!: number;

  @Column({ name: 'window_blur_count', type: 'int', default: 0 })
  windowBlurCount!: number;

  @Column({ name: 'proctoring_flagged', type: 'boolean', default: false })
  proctoringFlagged!: boolean;

  // §5.3 subject-integrity layer — the test version served for this attempt,
  // recorded at start for an auditable subject-version trail.
  @Column({ name: 'assigned_test_version', type: 'varchar', nullable: true })
  assignedTestVersion!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
