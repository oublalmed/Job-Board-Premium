import { Test, TestingModule } from '@nestjs/testing';
import { TrialCodeAdminController } from '../trial-code-admin.controller.js';
import { TrialCodeAdminService } from '../trial-code-admin.service.js';
import { SubscriptionPlan } from '../../companies/entities/subscription.entity.js';

describe('TrialCodeAdminController', () => {
  let controller: TrialCodeAdminController;
  let trialCodeAdminService: Record<string, jest.Mock>;

  beforeEach(async () => {
    trialCodeAdminService = {
      create: jest.fn().mockResolvedValue({ id: 'trial-code-1' }),
      revoke: jest.fn().mockResolvedValue({ id: 'trial-code-1', status: 'revoked' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrialCodeAdminController],
      providers: [
        { provide: TrialCodeAdminService, useValue: trialCodeAdminService },
      ],
    }).compile();

    controller = module.get(TrialCodeAdminController);
  });

  it('delegates creation to the service', async () => {
    const dto = {
      code: 'WELCOME2026',
      plan: SubscriptionPlan.GROWTH,
      trialDurationDays: 30,
      maxUses: 50,
    };

    const result = await controller.create(dto);

    expect(trialCodeAdminService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'trial-code-1' });
  });

  it('delegates revocation to the service', async () => {
    const result = await controller.revoke('trial-code-1');

    expect(trialCodeAdminService.revoke).toHaveBeenCalledWith('trial-code-1');
    expect(result).toEqual({ id: 'trial-code-1', status: 'revoked' });
  });
});
