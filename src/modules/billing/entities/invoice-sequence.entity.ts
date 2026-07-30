import { Entity, PrimaryColumn, Column } from 'typeorm';

// One row per calendar year. lastNumber only ever advances inside the same
// transaction as the Invoice it numbers — see allocateInvoiceNumber in
// invoice-numbering.ts for why this is a row-locked counter and not a
// Postgres SEQUENCE.
@Entity('invoice_sequences')
export class InvoiceSequence {
  @PrimaryColumn({ type: 'integer' })
  year!: number;

  @Column({ name: 'last_number', type: 'integer', default: 0 })
  lastNumber!: number;
}
