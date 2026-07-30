import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Subscription } from '../../companies/entities/subscription.entity.js';
import { Company } from '../../companies/entities/company.entity.js';

export const INVOICE_NUMBER_UNIQUE_CONSTRAINT = 'UQ_invoices_invoice_number';
export const INVOICE_STRIPE_EVENT_UNIQUE_CONSTRAINT =
  'UQ_invoices_stripe_invoice_id';

// Immutable once emitted: this entity has no update path anywhere in the
// codebase (InvoiceService only ever calls repo.insert(), never .save() on
// an existing row) — the legal record must not change after issuance.
// Named unique constraints (not TypeORM's auto-generated hash names),
// matching the reasoning in payment-webhook.service.ts: callers that need
// to discriminate WHICH constraint a 23505 hit must be able to name it.
@Entity('invoices')
@Index(INVOICE_NUMBER_UNIQUE_CONSTRAINT, ['invoiceNumber'], { unique: true })
@Index(INVOICE_STRIPE_EVENT_UNIQUE_CONSTRAINT, ['stripeInvoiceId'], {
  unique: true,
})
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'subscription_id' })
  subscriptionId!: string;

  @ManyToOne(() => Subscription, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'subscription_id' })
  subscription!: Subscription;

  @Column({ name: 'company_id' })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  // Format YYYY-NNNN (e.g. "2026-0001"), allocated by
  // allocateInvoiceNumber — gapless per calendar year.
  @Column({ name: 'invoice_number' })
  invoiceNumber!: string;

  // All amounts are integer centimes — never a float. See tax.ts.
  @Column({ name: 'amount_ht', type: 'integer' })
  amountHT!: number;

  @Column({ name: 'vat_rate', type: 'integer' })
  vatRate!: number;

  @Column({ name: 'vat_amount', type: 'integer' })
  vatAmount!: number;

  @Column({ name: 'amount_ttc', type: 'integer' })
  amountTTC!: number;

  @Column({ type: 'varchar', default: 'MAD' })
  currency!: string;

  // Copied from Company.ice at the moment of emission — deliberately NOT
  // derived by joining Company at read time. A legal invoice must reflect
  // the buyer's ICE as it was when the invoice was issued, not whatever
  // the company's ICE happens to be today if it were ever corrected/changed.
  @Column({ name: 'company_ice' })
  companyIce!: string;

  @Column({ name: 'issued_at', type: 'timestamptz' })
  issuedAt!: Date;

  @Column({ name: 'pdf_storage_key' })
  pdfStorageKey!: string;

  // Not a real Stripe Invoice object id (Lot 6C only handles
  // checkout.session.completed, which carries no expanded invoice data —
  // that requires invoice.paid, explicitly Lot 6D). Populated with the
  // WebhookEvent.providerEventId of the Stripe event that triggered
  // emission: unique per event, which is exactly the "one invoice per
  // Stripe payment" idempotence property this column exists to enforce.
  @Column({ name: 'stripe_invoice_id' })
  stripeInvoiceId!: string;

  // No updatedAt: an immutable row that is never updated has no meaningful
  // "last updated" moment. issuedAt is the sole, deliberate timestamp.
}
