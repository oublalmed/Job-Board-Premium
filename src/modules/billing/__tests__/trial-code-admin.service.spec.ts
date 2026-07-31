import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TrialCodeAdminService } from '../trial-code-admin.service.js';
import { TrialCode, TrialCodeStatus } from '../entities/trial-code.entity.js';
import { SubscriptionPlan } from '../../companies/entities/subscription.entity.js';

function uniqueViolation(): QueryFailedError {
  const driverError = Object.assign(
    new Error('duplicate key value violates unique constraint'),
    { code: '23505' },
  );
  return new QueryFailedError('INSERT INTO "trial_codes" ...', [], driverError);
}

describe('TrialCodeAdminService', () => {
  let service: TrialCodeAdminService;
  let trialCodeRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    trialCodeRepo = {
      create: jest.fn().mockImplementation((e: Record<string, unknown>) => e),
      save: jest.fn().mockImplementation((e: Record<string, unknown>) =>
        Promise.resolve({ id: 'trial-code-1', usedCount: 0, status: TrialCodeStatus.ACTIVE, ...e }),
      ),
      findOne: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrialCodeAdminService,
        { provide: getRepositoryToken(TrialCode), useValue: trialCodeRepo },
      ],
    }).compile();

    service = module.get(TrialCodeAdminService);
  });

  describe('create', () => {
    it('creates a trial code with the given fields, no expiry by default', async () => {
      const result = await service.create({
        code: 'WELCOME2026',
        plan: SubscriptionPlan.GROWTH,
        trialDurationDays: 30,
        maxUses: 50,
      });

      expect(trialCodeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'WELCOME2026',
          plan: SubscriptionPlan.GROWTH,
          trialDurationDays: 30,
          maxUses: 50,
          expiresAt: null,
        }),
      );
      expect(result.code).toBe('WELCOME2026');
    });

    it('parses expiresAt when provided', async () => {
      await service.create({
        code: 'LIMITED',
        plan: SubscriptionPlan.STARTER,
        trialDurationDays: 14,
        maxUses: 10,
        expiresAt: '2027-01-01T00:00:00.000Z',
      });

      expect(trialCodeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ expiresAt: new Date('2027-01-01T00:00:00.000Z') }),
      );
    });

    it('rejects a duplicate code with a clear 409, not a raw constraint error', async () => {
      trialCodeRepo.save.mockRejectedValueOnce(uniqueViolation());

      await expect(
        service.create({
          code: 'DUPLICATE',
          plan: SubscriptionPlan.STARTER,
          trialDurationDays: 14,
          maxUses: 10,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('revoke', () => {
    it('sets status to revoked', async () => {
      trialCodeRepo.findOne.mockResolvedValueOnce({
        id: 'trial-code-1',
        status: TrialCodeStatus.ACTIVE,
      });

      const result = await service.revoke('trial-code-1');

      expect(trialCodeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: TrialCodeStatus.REVOKED }),
      );
      expect(result.status).toBe(TrialCodeStatus.REVOKED);
    });

    it('is idempotent — revoking an already-revoked code is a no-op, not an error', async () => {
      trialCodeRepo.findOne.mockResolvedValueOnce({
        id: 'trial-code-1',
        status: TrialCodeStatus.REVOKED,
      });

      const result = await service.revoke('trial-code-1');

      expect(trialCodeRepo.save).not.toHaveBeenCalled();
      expect(result.status).toBe(TrialCodeStatus.REVOKED);
    });

    it('throws NotFoundException for an unknown id', async () => {
      trialCodeRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.revoke('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
