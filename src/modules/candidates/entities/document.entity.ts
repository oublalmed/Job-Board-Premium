import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

export enum DocumentType {
  CV = 'cv',
  CERTIFICATION = 'certification',
  OTHER = 'other',
  DIPLOMA = 'diploma',
}

export enum ScanStatus {
  PENDING = 'pending',
  CLEAN = 'clean',
  INFECTED = 'infected',
}

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'owner_id' })
  ownerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: User;

  @Column({ type: 'enum', enum: DocumentType })
  type!: DocumentType;

  @Column({ name: 'storage_key' })
  storageKey!: string;

  @Column({ name: 'original_name' })
  originalName!: string;

  @Column({ name: 'mime_type' })
  mimeType!: string;

  @Column({ type: 'integer' })
  size!: number;

  @Column({
    name: 'scan_status',
    type: 'enum',
    enum: ScanStatus,
    default: ScanStatus.PENDING,
  })
  scanStatus!: ScanStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
