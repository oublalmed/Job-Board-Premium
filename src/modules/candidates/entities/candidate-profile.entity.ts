import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

export enum ProfileVisibility {
  PUBLIC = 'public',
  RECRUITERS_ONLY = 'recruiters_only',
  HIDDEN = 'hidden',
}

@Entity('candidate_profiles')
export class CandidateProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', unique: true })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'first_name', type: 'varchar', nullable: true })
  firstName!: string | null;

  @Column({ name: 'last_name', type: 'varchar', nullable: true })
  lastName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  headline!: string | null;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ type: 'varchar', nullable: true })
  location!: string | null;

  @Column({ type: 'varchar', nullable: true })
  school!: string | null;

  // Set true only by SchoolVerificationService.approve() on an
  // admin/moderator decision — never writable via the candidate's own
  // profile update endpoint, since it's a claim about someone else's
  // review, not the candidate's own data.
  @Column({ name: 'school_verified', default: false })
  schoolVerified!: boolean;

  @Column({
    type: 'enum',
    enum: ProfileVisibility,
    default: ProfileVisibility.HIDDEN,
  })
  visibility!: ProfileVisibility;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  completeness!: number;

  @Column({ name: 'indexed_in_cvtheque', default: false })
  indexedInCvtheque!: boolean;

  @Column({ default: false })
  featured!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
