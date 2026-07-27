import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Specialty } from './specialty.entity.js';

@Entity('tests')
export class Test {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'specialty_id' })
  specialtyId!: string;

  @ManyToOne(() => Specialty, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'specialty_id' })
  specialty!: Specialty;

  @Column()
  version!: string;

  @Column({ nullable: true })
  provider!: string | null;

  @Column({ name: 'external_test_id', nullable: true })
  externalTestId!: string | null;

  @Column({ name: 'duration_minutes', type: 'integer', default: 60 })
  durationMinutes!: number;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
