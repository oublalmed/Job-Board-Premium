import { JobsRecruiterController } from '../jobs-recruiter.controller.js';
import { JobsService } from '../jobs.service.js';
import { ApplicationsService } from '../applications.service.js';
import { EntitlementService } from '../../entitlements/entitlement.service.js';
import { ApplicationStatus } from '../entities/job-application.entity.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';

const user = { sub: 'user-1' } as JwtPayload;
const companyId = 'comp-1';

describe('JobsRecruiterController (§3.1)', () => {
  let controller: JobsRecruiterController;
  let jobs: jest.Mocked<
    Pick<
      JobsService,
      | 'create'
      | 'listForCompany'
      | 'getForCompany'
      | 'update'
      | 'publish'
      | 'close'
    >
  >;
  let applications: jest.Mocked<
    Pick<ApplicationsService, 'listForOffer' | 'updateStatus'>
  >;
  let entitlements: jest.Mocked<Pick<EntitlementService, 'resolveCompanyId'>>;

  beforeEach(() => {
    jobs = {
      create: jest.fn().mockResolvedValue({ id: 'o1' }),
      listForCompany: jest.fn().mockResolvedValue([{ id: 'o1' }]),
      getForCompany: jest.fn().mockResolvedValue({ id: 'o1' }),
      update: jest.fn().mockResolvedValue({ id: 'o1' }),
      publish: jest.fn().mockResolvedValue({ id: 'o1', status: 'published' }),
      close: jest.fn().mockResolvedValue({ id: 'o1', status: 'closed' }),
    };
    applications = {
      listForOffer: jest.fn().mockResolvedValue([{ id: 'a1' }]),
      updateStatus: jest.fn().mockResolvedValue({ id: 'a1' }),
    };
    entitlements = {
      resolveCompanyId: jest.fn().mockResolvedValue(companyId),
    };
    controller = new JobsRecruiterController(
      jobs as unknown as JobsService,
      applications as unknown as ApplicationsService,
      entitlements as unknown as EntitlementService,
    );
  });

  it('create() resolves the company and delegates to the service', async () => {
    const res = await controller.create(user, { title: 'Backend' });
    expect(entitlements.resolveCompanyId).toHaveBeenCalledWith('user-1');
    expect(jobs.create).toHaveBeenCalledWith(companyId, 'user-1', {
      title: 'Backend',
    });
    expect(res).toEqual({ id: 'o1' });
  });

  it('list() returns the company offers', async () => {
    const res = await controller.list(user);
    expect(jobs.listForCompany).toHaveBeenCalledWith(companyId);
    expect(res).toHaveLength(1);
  });

  it('getOne() delegates with the resolved company', async () => {
    await controller.getOne(user, 'o1');
    expect(jobs.getForCompany).toHaveBeenCalledWith(companyId, 'o1');
  });

  it('update() delegates the dto', async () => {
    await controller.update(user, 'o1', { title: 'New' });
    expect(jobs.update).toHaveBeenCalledWith(companyId, 'o1', { title: 'New' });
  });

  it('publish() delegates', async () => {
    const res = await controller.publish(user, 'o1');
    expect(jobs.publish).toHaveBeenCalledWith(companyId, 'o1');
    expect(res.status).toBe('published');
  });

  it('close() delegates', async () => {
    const res = await controller.close(user, 'o1');
    expect(jobs.close).toHaveBeenCalledWith(companyId, 'o1');
    expect(res.status).toBe('closed');
  });

  it('applicationsFor() lists offer applications (company-scoped)', async () => {
    const res = await controller.applicationsFor(user, 'o1');
    expect(applications.listForOffer).toHaveBeenCalledWith('o1', companyId);
    expect(res).toHaveLength(1);
  });

  it('updateApplicationStatus() delegates with the company + status', async () => {
    await controller.updateApplicationStatus(user, 'a1', {
      status: ApplicationStatus.SHORTLISTED,
    });
    expect(applications.updateStatus).toHaveBeenCalledWith(
      'a1',
      companyId,
      ApplicationStatus.SHORTLISTED,
    );
  });
});
