import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

// EF-ADM-02 — an append-only version history of reference-data (settings)
// changes. One row is written on every SettingsService.set, capturing the
// value as of that change, who made it (null for automated/system writes) and
// when. This is the versioned-referential requirement's audit spine, queryable
// per key independently of the global audit log.
@Entity('setting_history')
export class SettingHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  key!: string;

  @Column({ type: 'text' })
  value!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ name: 'value_type', default: 'string' })
  valueType!: string;

  // The staff User.id who made the change; null for automated/system writes.
  @Column({ name: 'changed_by_id', type: 'uuid', nullable: true })
  changedById!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
