import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JobsService } from '../jobs.service.js';
import { JobOffer, JobStatus } from '../entities/job-offer.entity.js';
import { JobApplication } from '../entities/job-application.entity.js';

const companyId = 'comp-1';

describe('JobsService (§3)', () => {
  let service: JobsService;
  let offerRepo: Record<string, jest.Mock>;
  let applicationRepo: Record<string, jest.Mock>;
  let countQb: Record<string, jest.Mock>;
  let searchQb: Record<string, jest.Mock>;

  beforeEach(async () => {
    countQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    searchQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    offerRepo = {
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve({ id: 'o1', ...v })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(searchQb),
    };
    applicationRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(countQb),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: getRepositoryToken(JobOffer), useValue: offerRepo },
        {
          provide: getRepositoryToken(JobApplication),
          useValue: applicationRepo,
        },
      ],
    }).compile();

    service = module.get(JobsService);
  });

  it('creates an offer in DRAFT', async () => {
    const o = await service.create(companyId, 'u1', { title: 'Backend dev' });
    expect(offerRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId,
        createdBy: 'u1',
        title: 'Backend dev',
        status: JobStatus.DRAFT,
      }),
    );
    expect(o.id).toBe('o1');
  });

  it('publish sets PUBLISHED + publishedAt', async () => {
    offerRepo.findOne.mockResolvedValue({
      id: 'o1',
      companyId,
      status: JobStatus.DRAFT,
      publishedAt: null,
    });
    const o = await service.publish(companyId, 'o1');
    expect(o.status).toBe(JobStatus.PUBLISHED);
    expect(o.publishedAt).toBeInstanceOf(Date);
  });

  it('close sets CLOSED', async () => {
    offerRepo.findOne.mockResolvedValue({
      id: 'o1',
      companyId,
      status: JobStatus.PUBLISHED,
    });
    const o = await service.close(companyId, 'o1');
    expect(o.status).toBe(JobStatus.CLOSED);
  });

  it('scopes edits to the company (404 for another company)', async () => {
    offerRepo.findOne.mockResolvedValue(null);
    await expect(
      service.update(companyId, 'x', { title: 'y' }),
    ).rejects.toThrow(NotFoundException);
    expect(offerRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'x', companyId },
    });
  });

  it('lists company offers with application counts', async () => {
    offerRepo.find.mockResolvedValue([{ id: 'o1' }, { id: 'o2' }]);
    countQb.getRawMany.mockResolvedValue([{ offerId: 'o1', count: '3' }]);
    const rows = await service.listForCompany(companyId);
    expect(rows.find((r) => r.id === 'o1')?.applicationsCount).toBe(3);
    expect(rows.find((r) => r.id === 'o2')?.applicationsCount).toBe(0);
  });

  it('searchPublished filters to published + returns page metadata', async () => {
    searchQb.getManyAndCount.mockResolvedValue([[{ id: 'o1' }], 1]);
    const res = await service.searchPublished({
      q: 'react',
      contractType: undefined,
      page: 1,
      limit: 20,
    });
    expect(searchQb.where).toHaveBeenCalledWith('o.status = :status', {
      status: JobStatus.PUBLISHED,
    });
    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
  });

  it('getPublished 404 when the offer is not a published one', async () => {
    offerRepo.findOne.mockResolvedValue(null);
    await expect(service.getPublished('x')).rejects.toThrow(NotFoundException);
  });
});
