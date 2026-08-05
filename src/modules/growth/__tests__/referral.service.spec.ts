import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReferralService } from '../referral.service.js';
import { Referral } from '../entities/referral.entity.js';
import {
  ReferralConversion,
  ReferralConversionStatus,
} from '../entities/referral-conversion.entity.js';

describe('ReferralService', () => {
  let service: ReferralService;
  let referralRepo: Record<string, jest.Mock>;
  let conversionRepo: Record<string, jest.Mock>;

  const referrerId = 'referrer-1';

  beforeEach(async () => {
    referralRepo = {
      findOne: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve({ id: 'ref-1', ...v })),
    };
    conversionRepo = {
      findOne: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve(v)),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralService,
        { provide: getRepositoryToken(Referral), useValue: referralRepo },
        {
          provide: getRepositoryToken(ReferralConversion),
          useValue: conversionRepo,
        },
      ],
    }).compile();

    service = module.get(ReferralService);
  });

  describe('getOrCreateForUser', () => {
    it('creates a referral with a code on first request', async () => {
      referralRepo.findOne.mockResolvedValue(null);
      conversionRepo.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);

      const dto = await service.getOrCreateForUser(referrerId);

      expect(referralRepo.save).toHaveBeenCalledTimes(1);
      const saved = referralRepo.save.mock.calls[0][0];
      expect(saved.referrerUserId).toBe(referrerId);
      expect(typeof saved.code).toBe('string');
      expect(saved.code.length).toBeGreaterThan(0);
      expect(dto).toEqual({ code: saved.code, signups: 3, conversions: 1 });
    });

    it('returns the existing referral without creating a new one', async () => {
      referralRepo.findOne.mockResolvedValue({ id: 'ref-1', code: 'ABC123' });
      conversionRepo.count.mockResolvedValue(0);

      const dto = await service.getOrCreateForUser(referrerId);

      expect(referralRepo.save).not.toHaveBeenCalled();
      expect(dto.code).toBe('ABC123');
    });
  });

  describe('validateCode', () => {
    it('is false for empty/unknown and true for a known code', async () => {
      expect(await service.validateCode('')).toBe(false);

      referralRepo.findOne.mockResolvedValueOnce(null);
      expect(await service.validateCode('nope')).toBe(false);

      referralRepo.findOne.mockResolvedValueOnce({ id: 'ref-1' });
      expect(await service.validateCode('good')).toBe(true);
    });
  });

  describe('recordSignup', () => {
    it('is a no-op when no code is supplied', async () => {
      await service.recordSignup(undefined, 'referee-1');
      expect(conversionRepo.save).not.toHaveBeenCalled();
    });

    it('ignores self-referral', async () => {
      referralRepo.findOne.mockResolvedValue({
        id: 'ref-1',
        referrerUserId: referrerId,
      });
      await service.recordSignup('code', referrerId);
      expect(conversionRepo.save).not.toHaveBeenCalled();
    });

    it('ignores an already-attributed referee', async () => {
      referralRepo.findOne.mockResolvedValue({
        id: 'ref-1',
        referrerUserId: referrerId,
      });
      conversionRepo.findOne.mockResolvedValue({ id: 'conv-1' });
      await service.recordSignup('code', 'referee-2');
      expect(conversionRepo.save).not.toHaveBeenCalled();
    });

    it('records a new signup conversion', async () => {
      referralRepo.findOne.mockResolvedValue({
        id: 'ref-1',
        referrerUserId: referrerId,
      });
      conversionRepo.findOne.mockResolvedValue(null);

      await service.recordSignup('code', 'referee-3');

      expect(conversionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          referralId: 'ref-1',
          refereeUserId: 'referee-3',
          status: ReferralConversionStatus.SIGNED_UP,
        }),
      );
    });
  });

  describe('markConverted', () => {
    it('promotes a signed-up conversion to converted', async () => {
      await service.markConverted('referee-3');
      expect(conversionRepo.update).toHaveBeenCalledWith(
        {
          refereeUserId: 'referee-3',
          status: ReferralConversionStatus.SIGNED_UP,
        },
        expect.objectContaining({ status: ReferralConversionStatus.CONVERTED }),
      );
    });
  });
});
