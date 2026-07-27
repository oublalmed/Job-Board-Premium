import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { CandidateProfile } from './candidate-profile.entity.js';
import { Skill } from './skill.entity.js';

@Entity('profile_skills')
@Unique(['profileId', 'skillId'])
export class ProfileSkill {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'profile_id' })
  profileId!: string;

  @ManyToOne(() => CandidateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile!: CandidateProfile;

  @Column({ name: 'skill_id' })
  skillId!: string;

  @ManyToOne(() => Skill, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_id' })
  skill!: Skill;

  @Column({ nullable: true })
  level!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
