import { BadRequestException } from '@nestjs/common';
import { EntitlementsController } from '../entitlements.controller.js';
import { EntitlementsAdminController } from '../entitlements-admin.controller.js';
import { EntitlementService } from '../entitlement.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { Feature } from '../feature.enum.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';

const admin = { sub: 'admin-1', email: 'a@b.co', roles: [] } as JwtPayload;
const companyId = 'company-1';

describe('Entitlements controllers', () => {
  let entitlements: jest.Mocked<
    Pick<
      EntitlementService,
      | 'getEntitlementsForUser'
      | 'getEntitlementsForCompany'
      | 'listOverrides'
      | 'countUsers'
      | 'setOverride'
      | 'clearOverride'
    >
  >;
  let audit: { log: jest.Mock };
  let mine: EntitlementsController;
  let adminCtrl: EntitlementsAdminController;

  beforeEach(() => {
    entitlements = {
      getEntitlementsForUser: jest.fn().mockResolvedValue({ plan: 'scale' }),
      getEntitlementsForCompany: jest.fn().mockResolvedValue({ plan: 'scale' }),
      listOverrides: jest.fn().mockResolvedValue([{ id: 'o1' }]),
      countUsers: jest.fn().mockResolvedValue(3),
      setOverride: jest.fn().mockResolvedValue({ id: 'o1' }),
      clearOverride: jest.fn().mockResolvedValue(undefined),
    };
    audit = { log: jest.fn().mockResolvedValue({ id: 'a1' }) };
    mine = new EntitlementsController(
      entitlements as unknown as EntitlementService,
    );
    adminCtrl = new EntitlementsAdminController(
      entitlements as unknown as EntitlementService,
      audit as unknown as AuditService,
    );
  });

  it('GET /entitlements returns the caller company entitlements', async () => {
    const r = await mine.mine(admin);
    expect(entitlements.getEntitlementsForUser).toHaveBeenCalledWith('admin-1');
    expect(r).toEqual({ plan: 'scale' });
  });

  it('admin GET merges entitlements + overrides + usage', async () => {
    const r = await adminCtrl.get(companyId);
    expect(r).toMatchObject({
      plan: 'scale',
      overrides: [{ id: 'o1' }],
      usage: { users: 3 },
    });
  });

  it('admin PUT sets an override and audit-logs it', async () => {
    await adminCtrl.setOverride(admin, companyId, Feature.ANTI_CHEAT, {
      enabled: true,
      note: 'pilot',
    });
    expect(entitlements.setOverride).toHaveBeenCalledWith(
      companyId,
      Feature.ANTI_CHEAT,
      true,
      'admin-1',
      'pilot',
    );
    expect(audit.log).toHaveBeenCalled();
  });

  it('admin PUT rejects an unknown feature', async () => {
    await expect(
      adminCtrl.setOverride(admin, companyId, 'not_a_feature', {
        enabled: true,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('admin DELETE clears an override and audit-logs it', async () => {
    const r = await adminCtrl.clearOverride(admin, companyId, Feature.JOBS);
    expect(entitlements.clearOverride).toHaveBeenCalledWith(
      companyId,
      Feature.JOBS,
    );
    expect(audit.log).toHaveBeenCalled();
    expect(r).toEqual({ cleared: true });
  });
});
