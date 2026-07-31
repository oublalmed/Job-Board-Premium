import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ProfileViewService } from '../profile-view.service.js';
import { CandidateProfileView } from '../entities/candidate-profile-view.entity.js';
import { CandidateProfile } from '../../candidates/entities/candidate-profile.entity.js';
import { GrowthNotificationService } from '../../notifications/growth-notification.service.js';
import { UsersService } from '../../users/users.service.js';

describe('ProfileViewService', () => {
  let service: ProfileViewService;
  let viewRepo: Record<string, jest.Mock>;
  let candidateProfileRepo: Record<string, jest.Mock>;
  let dataSource: Record<string, jest.Mock>;
  let growthNotificationService: Record<string, jest.Mock>;
  let usersService: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;

  const recruiterId = 'recruiter-1';
  const candidateProfileId = 'profile-1';
  const companyId = 'company-1';

  beforeEach(async () => {
    viewRepo = {
      create: jest.fn().mockImplementation((e: Record<string, unknown>) => e),
      save: jest.fn().mockResolvedValue({ id: 'view-1' }),
    };
    candidateProfileRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: candidateProfileId, userId: 'candidate-user-1' }),
    };
    dataSource = {
      query: jest.fn().mockResolvedValue([{ id: 'cooldown-1' }]),
    };
    growthNotificationService = {
      notifyProfileViewed: jest.fn().mockResolvedValue(undefined),
    };
    usersService = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: 'candidate-user-1', email: 'candidate@example.com' }),
    };
    configService = {
      get: jest.fn().mockReturnValue(24),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileViewService,
        { provide: getRepositoryToken(CandidateProfileView), useValue: viewRepo },
        { provide: getRepositoryToken(CandidateProfile), useValue: candidateProfileRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: GrowthNotificationService, useValue: growthNotificationService },
        { provide: UsersService, useValue: usersService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(ProfileViewService);
  });

  it('always records the view, regardless of the notification claim outcome', async () => {
    await service.recordView(recruiterId, companyId, candidateProfileId);

    expect(viewRepo.create).toHaveBeenCalledWith({
      recruiterId,
      candidateProfileId,
      companyId,
    });
    expect(viewRepo.save).toHaveBeenCalled();
  });

  it('notifies when the atomic UPSERT claim succeeds (first view, or outside the cooldown window)', async () => {
    await service.recordView(recruiterId, companyId, candidateProfileId);

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      [recruiterId, candidateProfileId, 24],
    );
    expect(growthNotificationService.notifyProfileViewed).toHaveBeenCalledWith({
      recipientUserId: 'candidate-user-1',
      email: 'candidate@example.com',
    });
  });

  it('does not notify when the claim is lost — a view inside the cooldown window (anti-spam)', async () => {
    dataSource.query.mockResolvedValueOnce([]);

    await service.recordView(recruiterId, companyId, candidateProfileId);

    expect(growthNotificationService.notifyProfileViewed).not.toHaveBeenCalled();
  });

  it('records the view but skips notification silently when the candidate profile no longer resolves', async () => {
    candidateProfileRepo.findOne.mockResolvedValueOnce(null);

    await expect(
      service.recordView(recruiterId, companyId, candidateProfileId),
    ).resolves.toBeUndefined();
    expect(growthNotificationService.notifyProfileViewed).not.toHaveBeenCalled();
  });

  it('records the view but skips notification silently when the candidate user no longer resolves', async () => {
    usersService.findById.mockResolvedValueOnce(null);

    await expect(
      service.recordView(recruiterId, companyId, candidateProfileId),
    ).resolves.toBeUndefined();
    expect(growthNotificationService.notifyProfileViewed).not.toHaveBeenCalled();
  });
});
