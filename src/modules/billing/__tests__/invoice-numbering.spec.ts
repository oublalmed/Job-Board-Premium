import { allocateInvoiceNumber } from '../invoice-numbering.js';
import { InvoiceSequence } from '../entities/invoice-sequence.entity.js';

// The property that actually matters here — true row-locked
// serialization under concurrency — can only be proven against real
// Postgres: see test/invoice-numbering.e2e-spec.ts. This unit test pins
// the call contract (ensure-row-exists, then FOR UPDATE, then increment)
// with a mocked EntityManager, so a refactor that silently drops one of
// those steps fails fast without needing the database.
describe('allocateInvoiceNumber — call contract (mocked)', () => {
  it('ensures the year row exists (ON CONFLICT DO NOTHING), locks it FOR UPDATE, increments, and formats YYYY-NNNN', async () => {
    const insertExecute = jest.fn().mockResolvedValue(undefined);
    const insertBuilder = {
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: insertExecute,
    };

    const row = { year: 2026, lastNumber: 6 };
    const save = jest.fn().mockImplementation((r: typeof row) =>
      Promise.resolve(r),
    );
    const selectBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOneOrFail: jest.fn().mockResolvedValue(row),
    };

    const repo = {
      createQueryBuilder: jest.fn().mockReturnValue(selectBuilder),
      save,
    };

    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue(insertBuilder),
      }),
      getRepository: jest.fn().mockReturnValue(repo),
    };

    const result = await allocateInvoiceNumber(
      2026,
      manager as never,
    );

    expect(manager.getRepository).toHaveBeenCalledWith(InvoiceSequence);
    expect(insertBuilder.values).toHaveBeenCalledWith({
      year: 2026,
      lastNumber: 0,
    });
    expect(insertBuilder.orIgnore).toHaveBeenCalled();
    expect(selectBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(selectBuilder.where).toHaveBeenCalledWith('seq.year = :year', {
      year: 2026,
    });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ year: 2026, lastNumber: 7 }),
    );
    expect(result).toBe('2026-0007');
  });

  it('pads single-digit numbers to 4 digits', async () => {
    const row = { year: 2027, lastNumber: 0 };
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          into: jest.fn().mockReturnThis(),
          values: jest.fn().mockReturnThis(),
          orIgnore: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue(undefined),
        }),
      }),
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOneOrFail: jest.fn().mockResolvedValue(row),
        }),
        save: jest.fn().mockImplementation((r: typeof row) => Promise.resolve(r)),
      }),
    };

    const result = await allocateInvoiceNumber(2027, manager as never);
    expect(result).toBe('2027-0001');
  });
});
