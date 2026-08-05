import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

// Lot 8 (EF-ADM-05) — the amorçage funnel (CDC §2.2). One row per tracked
// step so funnels can be aggregated by type over any date range.
export enum AnalyticsEventType {
  SIGNUP = 'signup',
  EMAIL_VERIFIED = 'email_verified',
  TEST_STARTED = 'test_started',
  SCORE_OBTAINED = 'score_obtained',
  RECRUITER_CONTACT = 'recruiter_contact',
  SUBSCRIPTION_CREATED = 'subscription_created',
}

@Entity('analytics_events')
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'enum', enum: AnalyticsEventType })
  type!: AnalyticsEventType;

  // Nullable: some events are anonymous or fired for a non-user actor.
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
