import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Conversation } from './conversation.entity.js';

export enum MessageReportStatus {
  OPEN = 'open',
  REVIEWED = 'reviewed',
  DISMISSED = 'dismissed',
}

// EF-MSG-05 — a participant flags a conversation for abuse. The report is a
// moderation queue item (consumed later by admin, EF-ADM-01); creating it is
// the candidate/recruiter-facing half.
@Entity('message_reports')
export class MessageReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id' })
  @Index()
  conversationId!: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;

  @Column({ name: 'reporter_user_id' })
  reporterUserId!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({
    type: 'enum',
    enum: MessageReportStatus,
    default: MessageReportStatus.OPEN,
  })
  status!: MessageReportStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
