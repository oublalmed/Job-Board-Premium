import { AnalyticsAdminController } from '../analytics-admin.controller.js';
import { AnalyticsService } from '../analytics.service.js';
import { AdminAnalyticsService } from '../admin-analytics.service.js';

describe('AnalyticsAdminController (§5)', () => {
  let controller: AnalyticsAdminController;
  let funnelService: { funnel: jest.Mock };
  let adminAnalytics: { overview: jest.Mock };

  beforeEach(() => {
    funnelService = {
      funnel: jest.fn().mockResolvedValue({ rangeDays: 30, steps: [] }),
    };
    adminAnalytics = {
      overview: jest.fn().mockResolvedValue({ users: { total: 1 } }),
    };
    controller = new AnalyticsAdminController(
      funnelService as unknown as AnalyticsService,
      adminAnalytics as unknown as AdminAnalyticsService,
    );
  });

  it('funnel() parses the days query', async () => {
    await controller.funnel('7');
    expect(funnelService.funnel).toHaveBeenCalledWith(7);
    funnelService.funnel.mockClear();
    await controller.funnel(undefined);
    expect(funnelService.funnel).toHaveBeenCalledWith(undefined);
  });

  it('overview() delegates to the platform analytics service', async () => {
    const res = await controller.overview();
    expect(adminAnalytics.overview).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ users: { total: 1 } });
  });
});
