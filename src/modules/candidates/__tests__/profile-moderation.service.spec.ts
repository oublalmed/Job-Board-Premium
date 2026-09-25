import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProfileModerationService } from '../profile-moderation.service.js';
import {
  CandidateProfile,
  ProfileModerationStatus,
  ProfileVisibility,
} from '../entities/candidate-profile.entity.js';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../../common/enums/audit-action.enum.js';

describe('ProfileModerationService (EF-ADM-01)', () => {
  let service: ProfileModerationService;
  let repo: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;

  function makeProfile(over: Partial<CandidateProfile> = {}): CandidateProfile {
    return {
      id: 'p1',
      firstName: 'Sara',
      lastName: 'B',
      headline: 'Dev',
      visibility: ProfileVisibility.PUBLIC,
      moderationStatus: ProfileModerationStatus.ACTIVE,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      ...over,
    } as CandidateProfile;
  }

  beforeEach(async () => {
    repo = {
      findOne: jest.fn().mockResolvedValue(makeProfile()),
      save: jest.fn().mockImplementation((p: CandidateProfile) => Promise.resolve(p)),
      findAndCount: jest.fn().mockResolvedValue([[makeProfile()], 1]),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileModerationService,
        { provide: getRepositoryToken(CandidateProfile), useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get(ProfileModerationService);
  });

  describe('list', () => {
    it('filters by status and clamps the page size', async () => {
      await service.list({ status: ProfileModerationStatus.SUSPENDED, limit: 999 });
      const arg = repo.findAndCount.mock.calls[0][0];
      expect(arg.where).toEqual({ moderationStatus: ProfileModerationStatus.SUSPENDED });
      expect(arg.take).toBe(100); // clamped
    });

    it('returns views with a total', async () => {
      const result = await service.list({});
      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe('p1');
    });
  });

  describe('setModeration', () => {
    it('suspending forces visibility to HIDDEN and writes an audit entry', async () => {
      const result = await service.setModeration(
        'p1',
        ProfileModerationStatus.SUSPENDED,
        'admin-1',
      );
      const saved = repo.save.mock.calls[0][0] as CandidateProfile;
      expect(saved.moderationStatus).toBe(ProfileModerationStatus.SUSPENDED);
      expect(saved.visibility).toBe(ProfileVisibility.HIDDEN);
      expect(result.moderationStatus).toBe(ProfileModerationStatus.SUSPENDED);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.MODERATION_ACTION,
          entityType: 'candidate_profile',
          entityId: 'p1',
        }),
      );
    });

    it('reinstating leaves the candidate visibility choice untouched', async () => {
      repo.findOne.mockResolvedValue(
        makeProfile({
          moderationStatus: ProfileModerationStatus.SUSPENDED,
          visibility: ProfileVisibility.HIDDEN,
        }),
      );
      const result = await service.setModeration(
        'p1',
        ProfileModerationStatus.ACTIVE,
        'admin-1',
      );
      const saved = repo.save.mock.calls[0][0] as CandidateProfile;
      expect(saved.moderationStatus).toBe(ProfileModerationStatus.ACTIVE);
      // not forced back to PUBLIC — stays as the candidate had it
      expect(saved.visibility).toBe(ProfileVisibility.HIDDEN);
      expect(result.moderationStatus).toBe(ProfileModerationStatus.ACTIVE);
    });

    it('404s an unknown profile', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.setModeration('missing', ProfileModerationStatus.SUSPENDED, 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
