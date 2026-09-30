import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AntiCheatService } from '../anti-cheat.service.js';
import { Assessment } from '../../assessments/entities/assessment.entity.js';
import { CandidateProfile } from '../../candidates/entities/candidate-profile.entity.js';
import { Company } from '../../companies/entities/company.entity.js';

describe('AntiCheatService (§2)', () => {
  let service: AntiCheatService;
  let assessmentRepo: Record<string, jest.Mock>;
  let profileRepo: Record<string, jest.Mock>;
  let companyRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    assessmentRepo = { find: jest.fn().mockResolvedValue([]) };
    profileRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'p1', userId: 'u1' }),
    };
    companyRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'c1', antiCheatEnabled: true }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AntiCheatService,
        { provide: getRepositoryToken(Assessment), useValue: assessmentRepo },
        {
          provide: getRepositoryToken(CandidateProfile),
          useValue: profileRepo,
        },
        { provide: getRepositoryToken(Company), useValue: companyRepo },
      ],
    }).compile();

    service = module.get(AntiCheatService);
  });

  it('reads and writes the company toggle', async () => {
    expect(await service.getSetting('c1')).toEqual({ enabled: true });
    const r = await service.setSetting('c1', false);
    expect(companyRepo.update).toHaveBeenCalledWith(
      { id: 'c1' },
      { antiCheatEnabled: false },
    );
    expect(r).toEqual({ enabled: false });
  });

  it('defaults the toggle to enabled when the company is missing', async () => {
    companyRepo.findOne.mockResolvedValue(null);
    expect(await service.getSetting('c1')).toEqual({ enabled: true });
  });

  it('aggregates candidate integrity signals and derives the level', async () => {
    assessmentRepo.find.mockResolvedValue([
      {
        tabSwitchCount: 2,
        windowBlurCount: 1,
        proctoringFlagged: false,
        multiAccountFlagged: false,
      },
      {
        tabSwitchCount: 4,
        windowBlurCount: 0,
        proctoringFlagged: true,
        multiAccountFlagged: false,
      },
    ]);

    const r = await service.getCandidateIntegrity('c1', 'p1');
    expect(assessmentRepo.find).toHaveBeenCalledWith({
      where: { candidateId: 'u1' },
    });
    expect(r.assessmentsCount).toBe(2);
    expect(r.tabSwitchCount).toBe(6);
    expect(r.windowBlurCount).toBe(1);
    expect(r.proctoringFlagged).toBe(true);
    expect(r.level).toBe('high'); // proctoring flag
    expect(r.antiCheatEnabled).toBe(true);
    expect(r.suspiciousEvents).toBe(6 + 1 + 1);
  });

  it('throws NotFound for an unknown candidate', async () => {
    profileRepo.findOne.mockResolvedValue(null);
    await expect(service.getCandidateIntegrity('c1', 'x')).rejects.toThrow(
      NotFoundException,
    );
  });
});
