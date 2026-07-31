import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { CandidateProfile } from '../../candidates/entities/candidate-profile.entity.js';

// The anti-spam claim table for EF-GROW-04's "recruiter viewed your
// profile" notification: N views by the same recruiter on the same
// candidate within PROFILE_VIEW_NOTIFICATION_COOLDOWN_HOURS must produce at
// most one notification. The composite unique key is what an atomic
// UPSERT ... ON CONFLICT ... DO UPDATE ... WHERE claims against (see
// ProfileViewService.claimNotification) — never a read-then-write check.
@Entity('profile_view_cooldowns')
@Unique('UQ_profile_view_cooldowns_recruiter_candidate', [
  'recruiterId',
  'candidateProfileId',
])
export class ProfileViewCooldown {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'recruiter_id' })
  recruiterId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recruiter_id' })
  recruiter!: User;

  @Column({ name: 'candidate_profile_id' })
  candidateProfileId!: string;

  @ManyToOne(() => CandidateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile!: CandidateProfile;

  @UpdateDateColumn({ name: 'last_notified_at', type: 'timestamptz' })
  lastNotifiedAt!: Date;
}
