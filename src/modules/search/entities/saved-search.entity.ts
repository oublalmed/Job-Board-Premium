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
import { User } from '../../users/entities/user.entity.js';

// The persisted shape of a saved search's filters — a subset of
// SearchCandidatesDto (the pagination fields `cursor`/`limit` are runtime
// concerns, never stored). Kept structurally identical to the search filter
// DTO so a saved criteria round-trips straight back into SearchService.
export interface SavedSearchCriteria {
  q?: string;
  skills?: string[];
  scoreMin?: number;
  location?: string;
}

// EF-SRCH-04 — a recruiter's reusable CVthèque query. Owned by the recruiter
// (ownerUserId is always the authenticated user's id, never a body value), it
// stores the filter criteria as JSONB so the exact same search can be
// re-applied later, and — when alertEnabled — drives the daily alert sweep
// that notifies the owner about newly-indexed matching profiles.
@Entity('saved_searches')
// Every read/write scopes by owner (a recruiter only ever sees/touches their
// own), and the alert sweep loads all alert-enabled rows — this index keeps
// the owner predicate off a sequential scan.
@Index('IDX_saved_searches_owner_user_id', ['ownerUserId'])
export class SavedSearch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_user_id' })
  owner!: User;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'jsonb' })
  criteria!: SavedSearchCriteria;

  @Column({ name: 'alert_enabled', default: false })
  alertEnabled!: boolean;

  // The moment the last alert notification was emitted for this search. The
  // alert sweep only counts profiles indexed *after* this instant, and
  // advances it atomically — that advance is what makes each run idempotent
  // (a retried/concurrent sweep that reads the same value loses the race and
  // emits nothing). NULL until the first alert fires.
  @Column({ name: 'last_notified_at', type: 'timestamptz', nullable: true })
  lastNotifiedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
