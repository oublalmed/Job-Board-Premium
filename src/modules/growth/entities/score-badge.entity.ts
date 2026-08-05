import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Score } from '../../assessments/entities/score.entity.js';

// Lot 7 (EF-GROW-01) — a shareable, opt-in public showcase of a candidate's
// best score. One badge per candidate (unique user_id); it points at the
// score to display and carries an unguessable public token used in the
// share URL. Opt-out sets `enabled = false` rather than deleting the row,
// so re-enabling reuses the same public URL.
@Entity('score_badges')
export class ScoreBadge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', unique: true })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'score_id' })
  scoreId!: string;

  @ManyToOne(() => Score, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'score_id' })
  score!: Score;

  // Unguessable public identifier used in the share URL — not the score id,
  // so the public page can't be enumerated from sequential/internal ids.
  @Column({ name: 'token', type: 'uuid', unique: true })
  token!: string;

  // Opt-in switch: true means the public page resolves; false hides it
  // without discarding the token.
  @Column({ default: true })
  enabled!: boolean;

  // Opt-in display name shown on the public page. Null → the page shows a
  // neutral label, never the account email or full identity.
  @Column({ name: 'display_name', type: 'varchar', nullable: true })
  displayName!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
