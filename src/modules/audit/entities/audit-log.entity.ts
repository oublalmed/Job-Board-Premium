import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AuditAction } from '../../../common/enums/audit-action.enum.js';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'actor_id', nullable: true })
  @Index()
  actorId!: string | null;

  @Column({ type: 'enum', enum: AuditAction })
  @Index()
  action!: AuditAction;

  @Column({ name: 'entity_type', nullable: true })
  entityType!: string | null;

  @Column({ name: 'entity_id', nullable: true })
  entityId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  @Index()
  createdAt!: Date;
}
