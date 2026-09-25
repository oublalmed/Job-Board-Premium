import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity.js';

export enum MessageSenderRole {
  CANDIDATE = 'candidate',
  RECRUITER = 'recruiter',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id' })
  conversationId!: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;

  @Column({ name: 'sender_id' })
  senderId!: string;

  @Column({ name: 'sender_role', type: 'enum', enum: MessageSenderRole })
  senderRole!: MessageSenderRole;

  @Column({ type: 'text' })
  body!: string;

  // EF-MSG-03 — a single optional document attachment. Nullable columns on
  // `message` (rather than a separate message_attachment entity) is the
  // simpler model given the one-attachment-per-message rule. The binary lives
  // in object storage; only its metadata is persisted here. `storageKey` is
  // never exposed to clients — downloads go through the signed-url endpoint.
  @Column({ name: 'attachment_storage_key', type: 'text', nullable: true })
  attachmentStorageKey!: string | null;

  @Column({ name: 'attachment_original_name', type: 'text', nullable: true })
  attachmentOriginalName!: string | null;

  @Column({ name: 'attachment_mime_type', type: 'text', nullable: true })
  attachmentMimeType!: string | null;

  @Column({ name: 'attachment_size', type: 'integer', nullable: true })
  attachmentSize!: number | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
