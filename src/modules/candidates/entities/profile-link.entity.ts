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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
