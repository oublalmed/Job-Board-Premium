import { Test, TestingModule } from '@nestjs/testing';
import { TrialConversionService } from '../trial-conversion.service.js';

describe('TrialConversionService', () => {
  let service: TrialConversionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrialConversionService],
    }).compile();

    service = module.get(TrialConversionService);
  });

  it('marks the redemption row converted, scoped to companyId and only when not already converted', async () => {
    const updateQb: Record<string, jest.Mock> = {};
    for (const method of ['update', 'set', 'where', 'andWhere']) {
      updateQb[method] = jest.fn().mockReturnValue(updateQb);
    }
    updateQb.execute = jest.fn().mockResolvedValue({ affected: 1 });
    const redemptionRepo = { createQueryBuilder: jest.fn().mockReturnValue(updateQb) };
    const manager = {
      getRepository: jest.fn().mockReturnValue(redemptionRepo),
    } as never;

    await service.markConvertedIfApplicable('company-1', manager);

    expect(redemptionRepo.createQueryBuilder).toHaveBeenCalled();
    expect(updateQb.where).toHaveBeenCalledWith('company_id = :companyId', {
      companyId: 'company-1',
    });
    expect(updateQb.andWhere).toHaveBeenCalledWith('converted_at IS NULL');
  });

  it('is a harmless no-op when the company has no redemption row (nothing matches the UPDATE)', async () => {
    const updateQb: Record<string, jest.Mock> = {};
    for (const method of ['update', 'set', 'where', 'andWhere']) {
      updateQb[method] = jest.fn().mockReturnValue(updateQb);
    }
    updateQb.execute = jest.fn().mockResolvedValue({ affected: 0 });
    const redemptionRepo = { createQueryBuilder: jest.fn().mockReturnValue(updateQb) };
    const manager = {
      getRepository: jest.fn().mockReturnValue(redemptionRepo),
    } as never;

    await expect(
      service.markConvertedIfApplicable('company-without-redemption', manager),
    ).resolves.toBeUndefined();
  });
});
