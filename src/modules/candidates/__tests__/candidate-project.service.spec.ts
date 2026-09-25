import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CandidateProjectService } from '../candidate-project.service.js';
import { CandidateProfileService } from '../candidate-profile.service.js';
import { Project } from '../entities/project.entity.js';
import { CreateProjectDto } from '../dto/create-project.dto.js';

describe('CandidateProjectService (EF-CAND-07)', () => {
  let service: CandidateProjectService;
  let projectRepo: Record<string, jest.Mock>;
  let profileService: Record<string, jest.Mock>;

  const userId = 'user-1';
  const profile = { id: 'profile-1', userId };

  beforeEach(async () => {
    projectRepo = {
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ id: 'project-1', ...data })),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    profileService = {
      findOrCreateProfile: jest.fn().mockResolvedValue(profile),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidateProjectService,
        { provide: getRepositoryToken(Project), useValue: projectRepo },
        { provide: CandidateProfileService, useValue: profileService },
      ],
    }).compile();

    service = module.get(CandidateProjectService);
  });

  // ── Owner scoping ─────────────────────────────────────────────────────

  it('creates a project scoped to the resolved profile', async () => {
    await service.create(userId, {
      title: 'Cobalt',
      description: 'A recruitment platform',
    });

    expect(projectRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 'profile-1', title: 'Cobalt' }),
    );
  });

  it('lists only projects for the resolved profile', async () => {
    projectRepo.find.mockResolvedValue([]);

    await service.listMine(userId);

    expect(projectRepo.find).toHaveBeenCalledWith({
      where: { profileId: 'profile-1' },
      order: { startDate: 'DESC', createdAt: 'DESC' },
    });
  });

  it('scopes update by (id, profileId) in a single query, never load-then-check', async () => {
    projectRepo.findOne.mockResolvedValue({
      id: 'project-1',
      profileId: 'profile-1',
    });

    await service.update(userId, 'project-1', { title: 'Renamed' });

    expect(projectRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'project-1', profileId: 'profile-1' },
    });
  });

  it('throws NotFoundException updating a project belonging to another profile', async () => {
    projectRepo.findOne.mockResolvedValue(null);

    await expect(
      service.update(userId, 'someone-elses-project', { title: 'x' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException deleting a project belonging to another profile', async () => {
    projectRepo.delete.mockResolvedValue({ affected: 0 });

    await expect(
      service.remove(userId, 'someone-elses-project'),
    ).rejects.toThrow(NotFoundException);
  });

  it('deletes scoped by (id, profileId) on success', async () => {
    projectRepo.delete.mockResolvedValue({ affected: 1 });

    await service.remove(userId, 'project-1');

    expect(projectRepo.delete).toHaveBeenCalledWith({
      id: 'project-1',
      profileId: 'profile-1',
    });
  });

  // ── URL validation (DTO boundary) ─────────────────────────────────────

  describe('CreateProjectDto url validation', () => {
    async function errorsFor(payload: Record<string, unknown>) {
      return validate(plainToInstance(CreateProjectDto, payload));
    }

    it('accepts a valid https url', async () => {
      expect(
        await errorsFor({
          title: 'Cobalt',
          description: 'x',
          url: 'https://github.com/me/cobalt',
        }),
      ).toHaveLength(0);
    });

    it('accepts a missing url (optional)', async () => {
      expect(
        await errorsFor({ title: 'Cobalt', description: 'x' }),
      ).toHaveLength(0);
    });

    it('rejects a url without a protocol', async () => {
      expect(
        await errorsFor({
          title: 'Cobalt',
          description: 'x',
          url: 'github.com/me/cobalt',
        }),
      ).not.toHaveLength(0);
    });

    it('rejects a blank title', async () => {
      expect(await errorsFor({ title: '', description: 'x' })).not.toHaveLength(
        0,
      );
    });
  });
});
