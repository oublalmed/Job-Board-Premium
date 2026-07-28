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

  @Column({ name: 'first_name', nullable: true })
  firstName!: string | null;

  @Column({ name: 'last_name', nullable: true })
  lastName!: string | null;

  @Column({ nullable: true })
  headline!: string | null;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ nullable: true })
  availability!: string | null;

  @Column({ nullable: true })
  mobility!: string | null;

  @Column({ name: 'salary_min', type: 'integer', nullable: true })
  salaryMin!: number | null;

  @Column({ name: 'salary_max', type: 'integer', nullable: true })
  salaryMax!: number | null;

  @Column({ name: 'salary_visible', default: false })
  salaryVisible!: boolean;

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
