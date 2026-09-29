import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApplicationsService } from '../applications.service.js';
import { JobOffer, JobStatus } from '../entities/job-offer.entity.js';
import {
  JobApplication,
  ApplicationStatus,
} from '../entities/job-application.entity.js';
import { CandidateProfile } from '../../candidates/entities/candidate-profile.entity.js';

const companyId = 'comp-1';

describe('ApplicationsService (§3)', () => {
  let service: ApplicationsService;
  let appRepo: Record<string, jest.Mock>;
  let offerRepo: Record<string, jest.Mock>;
  let profileRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    appRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve({ id: 'a1', ...v })),
    };
    offerRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'o1',
        status: JobStatus.PUBLISHED,
        companyId,
      }),
    };
    profileRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'p1', userId: 'cand-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: getRepositoryToken(JobApplication), useValue: appRepo },
        { provide: getRepositoryToken(JobOffer), useValue: offerRepo },
        {
          provide: getRepositoryToken(CandidateProfile),
          useValue: profileRepo,
        },
      ],
    }).compile();

    service = module.get(ApplicationsService);
  });

  describe('apply', () => {
    it('creates an APPLIED application for a published offer', async () => {
      const a = await service.apply('cand-1', 'o1', { coverLetter: 'hi' });
      expect(appRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          jobOfferId: 'o1',
          candidateId: 'cand-1',
          candidateProfileId: 'p1',
          status: ApplicationStatus.APPLIED,
        }),
      );
      expect(a.id).toBe('a1');
    });

    it('404 when the offer is not published', async () => {
      offerRepo.findOne.mockResolvedValue({
        id: 'o1',
        status: JobStatus.DRAFT,
      });
      await expect(service.apply('cand-1', 'o1', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('400 when the candidate has no profile', async () => {
      profileRepo.findOne.mockResolvedValue(null);
      await expect(service.apply('cand-1', 'o1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('409 on a duplicate application', async () => {
      appRepo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(service.apply('cand-1', 'o1', {})).rejects.toThrow(
        ConflictException,
      );
    });
  });

  it('lists the candidate own applications with offer + status', async () => {
    appRepo.find.mockResolvedValue([
      {
        id: 'a1',
        status: ApplicationStatus.SHORTLISTED,
        createdAt: new Date(),
        jobOffer: {
          id: 'o1',
          title: 'Backend',
          status: JobStatus.PUBLISHED,
          company: { name: 'Acme' },
        },
      },
    ]);
    const rows = await service.listMine('cand-1');
    expect(rows[0].status).toBe(ApplicationStatus.SHORTLISTED);
    expect(rows[0].offer.companyName).toBe('Acme');
  });

  it('lists applications for a recruiter offer (company-scoped)', async () => {
    offerRepo.findOne.mockResolvedValue({ id: 'o1', companyId });
    appRepo.find.mockResolvedValue([
      {
        id: 'a1',
        status: ApplicationStatus.APPLIED,
        coverLetter: null,
        createdAt: new Date(),
        candidateProfileId: 'p1',
        candidateProfile: {
          firstName: 'Imane',
          lastName: 'K',
          headline: 'Dev',
        },
      },
    ]);
    const rows = await service.listForOffer('o1', companyId);
    expect(rows[0].candidate.firstName).toBe('Imane');
  });

  it('updateStatus is scoped to the company (404 otherwise)', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 'a1',
      jobOffer: { companyId: 'other' },
    });
    await expect(
      service.updateStatus('a1', companyId, ApplicationStatus.INTERVIEW),
    ).rejects.toThrow(NotFoundException);
  });

  it('updateStatus moves the application through the workflow', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 'a1',
      status: ApplicationStatus.APPLIED,
      jobOffer: { companyId },
    });
    const r = await service.updateStatus(
      'a1',
      companyId,
      ApplicationStatus.INTERVIEW,
    );
    expect(r.status).toBe(ApplicationStatus.INTERVIEW);
  });
});
