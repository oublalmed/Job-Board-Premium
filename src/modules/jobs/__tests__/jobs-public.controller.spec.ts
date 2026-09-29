import { JobsPublicController } from '../jobs-public.controller.js';
import { JobsService } from '../jobs.service.js';
import { ApplicationsService } from '../applications.service.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';

const user = { sub: 'cand-1' } as JwtPayload;

describe('JobsPublicController (§3.2)', () => {
  let controller: JobsPublicController;
  let jobs: jest.Mocked<Pick<JobsService, 'searchPublished' | 'getPublished'>>;
  let applications: jest.Mocked<
    Pick<ApplicationsService, 'listMine' | 'apply' | 'getEligibility'>
  >;

  beforeEach(() => {
    jobs = {
      searchPublished: jest
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
      getPublished: jest.fn().mockResolvedValue({ id: 'o1' }),
    };
    applications = {
      listMine: jest.fn().mockResolvedValue([{ id: 'a1' }]),
      apply: jest.fn().mockResolvedValue({ id: 'a1', status: 'applied' }),
      getEligibility: jest.fn().mockResolvedValue({ eligible: true }),
    };
    controller = new JobsPublicController(
      jobs as unknown as JobsService,
      applications as unknown as ApplicationsService,
    );
  });

  it('search() delegates the filters to the service', async () => {
    const res = await controller.search({ q: 'react', page: 1, limit: 20 });
    expect(jobs.searchPublished).toHaveBeenCalledWith({
      q: 'react',
      page: 1,
      limit: 20,
    });
    expect(res.total).toBe(0);
  });

  it('eligibility() delegates to the service', async () => {
    const res = await controller.eligibility(user);
    expect(applications.getEligibility).toHaveBeenCalledWith('cand-1');
    expect(res).toEqual({ eligible: true });
  });

  it('mine() lists the caller applications', async () => {
    const res = await controller.mine(user);
    expect(applications.listMine).toHaveBeenCalledWith('cand-1');
    expect(res).toHaveLength(1);
  });

  it('detail() returns a published offer', async () => {
    const res = await controller.detail('o1');
    expect(jobs.getPublished).toHaveBeenCalledWith('o1');
    expect(res).toEqual({ id: 'o1' });
  });

  it('apply() delegates the candidate, offer and dto', async () => {
    const res = await controller.apply(user, 'o1', { coverLetter: 'hi' });
    expect(applications.apply).toHaveBeenCalledWith('cand-1', 'o1', {
      coverLetter: 'hi',
    });
    expect(res.status).toBe('applied');
  });
});
