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
import { CandidateProfile } from './candidate-profile.entity.js';

// EF-CAND-07 — structured "projets" on the candidate profile, mirroring the
// certifications entity. Previously the CDC listed projects as a profile
// sub-entity with nowhere to persist the actual records; this makes each
// project a first-class, owner-scoped row. Indexed on profile_id, the column
// every read scopes by (same authorization pattern as Certification).
@Index('IDX_projects_profile_id', ['profileId'])
@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'profile_id' })
  profileId!: string;

  @ManyToOne(() => CandidateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile!: CandidateProfile;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', nullable: true })
  url!: string | null;

  @Column({ type: 'varchar', nullable: true })
  role!: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
