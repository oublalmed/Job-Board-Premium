import { AnalyticsRecruiterController } from '../analytics-recruiter.controller.js';
import { RecruiterAnalyticsService } from '../recruiter-analytics.service.js';
import { EntitlementService } from '../../entitlements/entitlement.service.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';

const user = { sub: 'user-1' } as JwtPayload;

describe('AnalyticsRecruiterController (§4)', () => {
  let controller: AnalyticsRecruiterController;
  let service: { overview: jest.Mock };
  let entitlements: { resolveCompanyId: jest.Mock };

  beforeEach(() => {
    service = { overview: jest.fn().mockResolvedValue({ rangeDays: 30 }) };
    entitlements = {
      resolveCompanyId: jest.fn().mockResolvedValue('comp-1'),
    };
    controller = new AnalyticsRecruiterController(
      service as unknown as RecruiterAnalyticsService,
      entitlements as unknown as EntitlementService,
    );
  });

  it('resolves the company and passes a parsed day range', async () => {
    await controller.overview(user, '14');
    expect(entitlements.resolveCompanyId).toHaveBeenCalledWith('user-1');
    expect(service.overview).toHaveBeenCalledWith('comp-1', 14);
  });

  it('passes undefined (service default) when days is absent or invalid', async () => {
    await controller.overview(user, undefined);
    expect(service.overview).toHaveBeenCalledWith('comp-1', undefined);

    service.overview.mockClear();
    await controller.overview(user, 'abc');
    expect(service.overview).toHaveBeenCalledWith('comp-1', undefined);
  });
});
