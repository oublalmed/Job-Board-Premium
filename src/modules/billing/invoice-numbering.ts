import { EntityManager } from 'typeorm';
import { InvoiceSequence } from './entities/invoice-sequence.entity.js';

const INVOICE_NUMBER_PADDING = 4;

// Gap-free, per-calendar-year invoice numbering (e.g. "2026-0001"),
// required by the Moroccan tax administration's continuous-numbering
// obligation for legal invoices.
//
// Deliberately a row-locked counter, NOT a Postgres SEQUENCE:
// nextval() on a sequence is non-transactional — it advances even if the
// surrounding transaction later rolls back, and it is never reclaimed.
// If invoice emission failed after drawing a number from a sequence (a
// PDF generation error, an S3 upload failure, anything), that number
// would be gone forever: a permanent gap in the legal numbering. A gap is
// not a cosmetic issue here — gap-free numbering IS the obligation, not a
// side property of it.
//
// This function MUST be called inside the same transaction as the
// Invoice INSERT it numbers. SELECT ... FOR UPDATE takes a row-level lock
// on the year's counter row for the rest of that transaction: a
// concurrent call for the same year blocks until this transaction commits
// or rolls back, then re-reads the CURRENT committed value (FOR UPDATE
// never returns a stale MVCC snapshot) — allocations for one year are
// strictly serialized, so two concurrent emissions can never receive the
// same number, and a rollback here means lastNumber was never advanced at
// all (the whole point: rollback = number not consumed = no gap). The
// cost — emissions for the same year serialize — is not a concern at this
// volume (nowhere near per-second invoice rates), and correctness of the
// legal numbering outweighs throughput here regardless.
export async function allocateInvoiceNumber(
  year: number,
  manager: EntityManager,
): Promise<string> {
  const repo = manager.getRepository(InvoiceSequence);

  // Ensures the year's row exists without racing a concurrent transaction
  // that might be creating it at the same instant: ON CONFLICT DO NOTHING
  // makes this a no-op if the row already exists (created by us moments
  // ago, or by whoever wins the race), so the FOR UPDATE select below
  // always has a row to lock.
  await manager
    .createQueryBuilder()
    .insert()
    .into(InvoiceSequence)
    .values({ year, lastNumber: 0 })
    .orIgnore()
    .execute();

  const row = await repo
    .createQueryBuilder('seq')
    .setLock('pessimistic_write')
    .where('seq.year = :year', { year })
    .getOneOrFail();

  row.lastNumber += 1;
  await repo.save(row);

  return `${year}-${String(row.lastNumber).padStart(INVOICE_NUMBER_PADDING, '0')}`;
}
