import { computeVat, VAT_RATE_PERCENT } from '../tax.js';

describe('computeVat', () => {
  it('applies the 20% Morocco standard VAT rate', () => {
    expect(VAT_RATE_PERCENT).toBe(20);
  });

  it('computes HT + VAT = TTC exactly for the growth plan price, as exact integers', () => {
    const result = computeVat(290000);
    expect(result).toEqual({
      amountHT: 290000,
      vatAmount: 58000,
      amountTTC: 348000,
    });
    expect(Number.isInteger(result.vatAmount)).toBe(true);
    expect(Number.isInteger(result.amountTTC)).toBe(true);
  });

  it('never returns a non-integer amount, even for HT values whose exact VAT is a fractional centime', () => {
    // 0.2 has no exact binary floating-point representation — multiplying
    // by it directly leaks that imprecision into the result (e.g.
    // 33 * 0.2 === 6.6000000000000005, not an integer). computeVat must
    // never surface that: every returned field is an exact integer centime.
    expect(33 * 0.2).not.toBe(Math.round(33 * 0.2)); // documents the imprecision this guards against
    for (const amountHT of [1, 3, 7, 11, 33, 99, 12345, 999999]) {
      const result = computeVat(amountHT);
      expect(Number.isInteger(result.vatAmount)).toBe(true);
      expect(Number.isInteger(result.amountTTC)).toBe(true);
      expect(result.amountTTC).toBe(result.amountHT + result.vatAmount);
    }
  });

  it('computes correctly for the starter plan price (99000 centimes HT)', () => {
    expect(computeVat(99000)).toEqual({
      amountHT: 99000,
      vatAmount: 19800,
      amountTTC: 118800,
    });
  });

  it('computes correctly for the scale plan price (690000 centimes HT)', () => {
    expect(computeVat(690000)).toEqual({
      amountHT: 690000,
      vatAmount: 138000,
      amountTTC: 828000,
    });
  });

  it('rounds to the nearest centime for an HT amount that does not divide evenly by 5', () => {
    // 33 * 20 / 100 = 6.6 -> rounds to 7, never left as a fractional centime.
    const result = computeVat(33);
    expect(result.vatAmount).toBe(7);
    expect(Number.isInteger(result.vatAmount)).toBe(true);
  });

  it('handles zero', () => {
    expect(computeVat(0)).toEqual({ amountHT: 0, vatAmount: 0, amountTTC: 0 });
  });
});
