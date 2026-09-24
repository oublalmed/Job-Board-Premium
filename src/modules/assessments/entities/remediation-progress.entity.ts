import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

// EF-CAND-09 — tracks which remediation resources a candidate has marked as
// completed, turning the static resource list into an actionable progress
// journey. Keyed by the resource URL (the stable identity of an entry in the
// remediation-resources table); one row per (candidate, resource).
@Entity('remediation_progress')
@Unique('UQ_remediation_progress_candidate_resource', [
  'candidateId',
  'resourceUrl',
])
export class RemediationProgress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_remediation_progress_candidate')
  @Column({ name: 'candidate_id', type: 'uuid' })
  candidateId!: string;

  @Column({ name: 'resource_url', type: 'varchar', length: 2048 })
  resourceUrl!: string;

  @CreateDateColumn({ name: 'completed_at', type: 'timestamptz' })
  completedAt!: Date;
}
