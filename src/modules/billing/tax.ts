// Morocco standard VAT rate — a CDC/legal decision (§7), not a per-deployment
// tuning knob, hence a code constant rather than an env-configurable value
// like the plan prices it applies to.
export const VAT_RATE_PERCENT = 20;

export interface VatBreakdown {
  amountHT: number;
  vatAmount: number;
  amountTTC: number;
}

// All amounts are integer centimes throughout — never a float in, never a
// float out. `amountHT * VAT_RATE_PERCENT` is always an exact integer
// product (both operands are integers, and IEEE-754 doubles represent
// integers exactly up to 2^53) — the single `/100` is the only place a
// fractional value can appear, and Math.round resolves it to an exact
// integer centime immediately, before it is ever stored or returned.
// Deliberately not `amountHT * 0.20`: multiplying by a non-exact binary
// fraction (0.2 has no exact float representation — e.g. 33 * 0.2 ===
// 6.6000000000000005) introduces representation error into the
// computation itself. Rounding happens to absorb it for every amount
// checked here, but "usually correct" isn't the bar for a legal invoice;
// exact integer arithmetic removes the question entirely.
export function computeVat(amountHT: number): VatBreakdown {
  const vatAmount = Math.round((amountHT * VAT_RATE_PERCENT) / 100);
  return {
    amountHT,
    vatAmount,
    amountTTC: amountHT + vatAmount,
  };
}

// The reverse direction — Lot 6D proration: Stripe reports what it
// actually charged as a TTC amount (proration_behavior computes and
// invoices the customer directly), never an HT figure we could feed to
// computeVat above. Same single-rounding discipline as computeVat, just
// applied to the other operand: amountHT is the one value derived via
// Math.round, vatAmount is the remainder (amountTTC - amountHT) rather
// than an independently rounded 20% — guaranteeing amountHT + vatAmount
// === amountTTC exactly, never off by a centime from two separate
// roundings.
export function computeVatFromTtc(amountTTC: number): VatBreakdown {
  const amountHT = Math.round(
    (amountTTC * 100) / (100 + VAT_RATE_PERCENT),
  );
  return {
    amountHT,
    vatAmount: amountTTC - amountHT,
    amountTTC,
  };
}
