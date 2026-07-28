import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CandidateProfile } from './candidate-profile.entity.js';

export enum ExperienceType {
  WORK = 'work',
  EDUCATION = 'education',
}

@Entity('experiences')
export class Experience {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'profile_id' })
  profileId!: string;

  @ManyToOne(() => CandidateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile!: CandidateProfile;

  @Column({ type: 'enum', enum: ExperienceType })
  type!: ExperienceType;

  @Column()
  title!: string;

  @Column()
  organization!: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
