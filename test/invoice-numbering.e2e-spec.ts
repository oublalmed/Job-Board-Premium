import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { allocateInvoiceNumber } from '../src/modules/billing/invoice-numbering';

describe('allocateInvoiceNumber (e2e) — gap-free invoice numbering, Lot 6C', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // A fresh, never-before-used "year" per test — avoids collisions with
  // leftover InvoiceSequence rows from previous runs of this same suite
  // against the persistent dev database (the entity's PK is the year
  // itself, so reusing a real calendar year across runs would make the
  // "starts at 0001" assertions fail on a second run).
  let yearCounter = Math.floor(Date.now() / 1000);
  function nextTestYear(): number {
    yearCounter += 1;
    return yearCounter;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('allocates sequential numbers 0001, 0002, 0003 for successive calls in the same year', async () => {
    const year = nextTestYear();

    const first = await dataSource.transaction((manager) =>
      allocateInvoiceNumber(year, manager),
    );
    const second = await dataSource.transaction((manager) =>
      allocateInvoiceNumber(year, manager),
    );
    const third = await dataSource.transaction((manager) =>
      allocateInvoiceNumber(year, manager),
    );

    expect([first, second, third]).toEqual([
      `${year}-0001`,
      `${year}-0002`,
      `${year}-0003`,
    ]);
  });

  it('resets to 0001 for a different year — no cross-year leakage', async () => {
    const yearA = nextTestYear();
    const yearB = nextTestYear();

    await dataSource.transaction((manager) =>
      allocateInvoiceNumber(yearA, manager),
    );
    await dataSource.transaction((manager) =>
      allocateInvoiceNumber(yearA, manager),
    );

    const firstOfYearB = await dataSource.transaction((manager) =>
      allocateInvoiceNumber(yearB, manager),
    );

    expect(firstOfYearB).toBe(`${yearB}-0001`);
  });

  it('does not consume a number when the transaction rolls back after allocating it', async () => {
    const year = nextTestYear();

    await expect(
      dataSource.transaction(async (manager) => {
        await allocateInvoiceNumber(year, manager);
        throw new Error('simulated failure after allocation');
      }),
    ).rejects.toThrow('simulated failure after allocation');

    // The rolled-back attempt must not have consumed 0001 — this is the
    // central legal invariant: rollback = number not consumed = no gap.
    const nextReal = await dataSource.transaction((manager) =>
      allocateInvoiceNumber(year, manager),
    );
    expect(nextReal).toBe(`${year}-0001`);
  });

  it('yields strictly sequential, gap-free, duplicate-free numbers under real concurrency (the key test)', async () => {
    const year = nextTestYear();
    const CONCURRENT_ALLOCATIONS = 20;

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENT_ALLOCATIONS }, () =>
        dataSource.transaction((manager) => allocateInvoiceNumber(year, manager)),
      ),
    );

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const numbers = results
      .filter(
        (r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled',
      )
      .map((r) => r.value);

    // No duplicates.
    expect(new Set(numbers).size).toBe(CONCURRENT_ALLOCATIONS);

    // No gaps: the sorted sequence of allocated numbers is exactly
    // 0001..0020, nothing skipped, nothing repeated.
    const sortedSuffixes = numbers
      .map((n) => parseInt(n.split('-')[1] ?? '0', 10))
      .sort((a, b) => a - b);
    expect(sortedSuffixes).toEqual(
      Array.from({ length: CONCURRENT_ALLOCATIONS }, (_, i) => i + 1),
    );

    // Every number carries the right year prefix and zero-padded format.
    for (const n of numbers) {
      expect(n).toMatch(new RegExp(`^${year}-\\d{4}$`));
    }
  });
});
