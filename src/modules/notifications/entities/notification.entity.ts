import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

export enum NotificationType {
  COOLDOWN_EXPIRED = 'cooldown_expired',
  PROFILE_VIEWED = 'profile_viewed',
  // EF-MSG-02 — a new message arrived in one of the recipient's threads.
  NEW_MESSAGE = 'new_message',
  // EF-SRCH-04 — newly-indexed candidates match a recruiter's saved search.
  SAVED_SEARCH_ALERT = 'saved_search_alert',
  // EF-MSG-04 — an interview slot was proposed in one of the recipient's threads.
  INTERVIEW_PROPOSED = 'interview_proposed',
  // EF-MSG-04 — a proposed interview was accepted, declined or cancelled.
  INTERVIEW_UPDATED = 'interview_updated',
}

// The in-app half of "in-app + email" — neither EF-REM-03 nor EF-GROW-04
// had anything to attach to before this (5B messaging never actually built
// EF-MSG-02's in-app+email despite the CDC listing it — see Lot 7 PROGRESS
// notes). `readAt` is set by the owner-scoped mark-as-read endpoints
// (PATCH /notifications/:id/read and /notifications/read-all).
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'recipient_user_id' })
  recipientUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_user_id' })
  recipient!: User;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
