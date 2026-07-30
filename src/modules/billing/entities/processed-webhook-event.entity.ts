import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export const PROCESSED_WEBHOOK_EVENT_UNIQUE_CONSTRAINT =
  'UQ_processed_webhook_events_provider_event_id';

// Layer 1 of the webhook idempotence strategy: provider_event_id is UNIQUE,
// so a second delivery of the same event hits a constraint violation
// (23505) instead of a prior findOne-then-insert check — the same pattern
// as Conversation's UNIQUE(candidate_id, company_id) in Lot 5B. Layer 2 is
// the business-level guard (assertValidSubscriptionTransition +
// UQ_subscriptions_company_active from Lot 6A) for effects that also need
// to be safe against non-webhook concurrent writers.
//
// Named explicitly (not left to TypeORM's auto-generated hash) because
// PaymentWebhookService's catch block must discriminate this constraint
// from UQ_subscriptions_company_active — both can raise 23505 inside the
// same transaction, and only a violation of THIS constraint means "replay,
// already processed". See PROCESSED_WEBHOOK_EVENT_UNIQUE_CONSTRAINT usage
// in payment-webhook.service.ts.
@Entity('processed_webhook_events')
@Index(PROCESSED_WEBHOOK_EVENT_UNIQUE_CONSTRAINT, ['providerEventId'], {
  unique: true,
})
export class ProcessedWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'provider_event_id' })
  providerEventId!: string;

  @Column()
  provider!: string;

  @Column({ name: 'event_type' })
  eventType!: string;

  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt!: Date;
}
