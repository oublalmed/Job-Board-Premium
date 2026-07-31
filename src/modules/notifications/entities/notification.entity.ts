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
}

// The in-app half of "in-app + email" — neither EF-REM-03 nor EF-GROW-04
// had anything to attach to before this (5B messaging never actually built
// EF-MSG-02's in-app+email despite the CDC listing it — see Lot 7 PROGRESS
// notes). Deliberately minimal: no read-tracking endpoint yet
// (`readAt` exists for a future PATCH, not wired to anything today).
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
