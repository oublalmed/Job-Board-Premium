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

// The rights a data subject can exercise under the Moroccan CNDP framework
// (loi 09-08) — mirrors the GDPR data-subject rights the CDC references.
export enum DataRequestType {
  ACCESS = 'access',
  PORTABILITY = 'portability',
  ERASURE = 'erasure',
  RECTIFICATION = 'rectification',
  OBJECTION = 'objection',
}

// Lifecycle of a request inside the admin processing queue.
export enum DataRequestStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

// EF-ADM-03 — a CNDP/RGPD data-subject request. Before this, export/erasure
// were immediate and self-service with no trace beyond the audit log; there
// was no way for staff to see, triage, or evidence the handling of a request
// within the legal delay. This entity makes each request an auditable,
// SLA-tracked queue item: the candidate files it, an admin processes it, and
// `dueAt` (filing + 30 days) makes the legal deadline visible.
@Entity('data_requests')
export class DataRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'enum', enum: DataRequestType })
  type!: DataRequestType;

  @Column({
    type: 'enum',
    enum: DataRequestStatus,
    default: DataRequestStatus.PENDING,
  })
  @Index()
  status!: DataRequestStatus;

  // Optional note from the subject (e.g. what to rectify, why they object).
  @Column({ type: 'text', nullable: true })
  message!: string | null;

  // Note recorded by the admin when resolving/rejecting the request.
  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote!: string | null;

  @Column({ name: 'handled_by_user_id', type: 'uuid', nullable: true })
  @Index()
  handledByUserId!: string | null;

  // CNDP legal deadline for processing: filing date + 30 days. Persisted (not
  // derived) so the queue can sort/alert on it and it survives clock changes.
  @Column({ name: 'due_at', type: 'timestamptz' })
  dueAt!: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
