import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Conversation } from './conversation.entity.js';
import { MessageSenderRole } from './message.entity.js';

// EF-MSG-04 — an interview proposal lives inside a conversation. Either party
// may propose a slot; the *other* party accepts or declines, and the proposer
// may cancel. State transitions are guarded in InterviewService, never here.
export enum InterviewStatus {
  PROPOSED = 'proposed',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  CANCELLED = 'cancelled',
}

export enum InterviewMode {
  ONSITE = 'onsite',
  VIDEO = 'video',
  PHONE = 'phone',
}

@Entity('interviews')
export class Interview {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'conversation_id' })
  conversationId!: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;

  // The User.id and role of whoever proposed the slot. The counterpart is the
  // opposite role — the only party allowed to accept/decline.
  @Column({ name: 'proposed_by_id' })
  proposedById!: string;

  @Column({ name: 'proposed_by_role', type: 'enum', enum: MessageSenderRole })
  proposedByRole!: MessageSenderRole;

  @Column({
    type: 'enum',
    enum: InterviewStatus,
    default: InterviewStatus.PROPOSED,
  })
  status!: InterviewStatus;

  @Column({ type: 'enum', enum: InterviewMode })
  mode!: InterviewMode;

  @Column({ name: 'scheduled_at', type: 'timestamptz' })
  scheduledAt!: Date;

  @Column({ name: 'duration_minutes', type: 'int', default: 60 })
  durationMinutes!: number;

  // Address (onsite), meeting URL (video) or phone number (phone). Optional.
  @Column({ type: 'varchar', length: 500, nullable: true })
  location!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
