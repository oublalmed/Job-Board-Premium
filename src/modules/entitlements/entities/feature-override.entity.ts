import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity.js';

// §12 — how a feature came to be active for a company.
export enum FeatureSource {
  PACKAGE = 'package', // granted by the plan matrix
  ADMIN_OVERRIDE = 'admin_override', // manually toggled by an admin
  SYSTEM = 'system',
}

// §12 — an admin-set override on top of the plan matrix: force a feature on or
// off for one company. One current row per (company, feature); each change is
// also written to the audit log for history.
@Entity('feature_overrides')
@Unique('UQ_feature_overrides_company_feature', ['companyId', 'feature'])
export class FeatureOverride {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id' })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  // A Feature enum value.
  @Column()
  feature!: string;

  @Column()
  enabled!: boolean;

  // Who set it (admin user id), for traceability.
  @Column({ name: 'actor_id', type: 'varchar', nullable: true })
  actorId!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
