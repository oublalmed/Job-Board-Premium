import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
