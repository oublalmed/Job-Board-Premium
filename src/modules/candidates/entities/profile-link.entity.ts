import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { CandidateProfile } from './candidate-profile.entity.js';

export enum LinkType {
  GITHUB = 'github',
  PORTFOLIO = 'portfolio',
  LINKEDIN = 'linkedin',
  OTHER = 'other',
}

// EF-CAND-04 — result of the asynchronous accessibility verification. A link
// starts PENDING at creation and is moved to REACHABLE / UNREACHABLE by the
// background verification worker.
export enum LinkAccessibilityStatus {
  PENDING = 'pending',
  REACHABLE = 'reachable',
  UNREACHABLE = 'unreachable',
}

@Entity('profile_links')
export class ProfileLink {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'profile_id' })
  profileId!: string;

  @ManyToOne(() => CandidateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile!: CandidateProfile;

  @Column({ type: 'enum', enum: LinkType })
  type!: LinkType;

  @Column()
  url!: string;

  @Column({ type: 'varchar', nullable: true })
  label!: string | null;

  @Column({
    name: 'accessibility_status',
    type: 'enum',
    enum: LinkAccessibilityStatus,
    default: LinkAccessibilityStatus.PENDING,
  })
  accessibilityStatus!: LinkAccessibilityStatus;

  @Column({ name: 'checked_at', type: 'timestamptz', nullable: true })
  checkedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
