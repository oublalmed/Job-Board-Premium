import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CandidateCertificationService } from '../candidate-certification.service.js';
import { CandidateProfileService } from '../candidate-profile.service.js';
import { Certification } from '../entities/certification.entity.js';
import { CreateCertificationDto } from '../dto/create-certification.dto.js';

describe('CandidateCertificationService', () => {
  let service: CandidateCertificationService;
  let certificationRepo: Record<string, jest.Mock>;
  let profileService: Record<string, jest.Mock>;

  const userId = 'user-1';
  const profile = { id: 'profile-1', userId };

  beforeEach(async () => {
    certificationRepo = {
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ id: 'cert-1', ...data })),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    profileService = {
      findOrCreateProfile: jest.fn().mockResolvedValue(profile),
      calculateCompleteness: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidateCertificationService,
        {
          provide: getRepositoryToken(Certification),
          useValue: certificationRepo,
        },
        { provide: CandidateProfileService, useValue: profileService },
      ],
    }).compile();

    service = module.get(CandidateCertificationService);
  });

  // ── Owner scoping ─────────────────────────────────────────────────────

  it('creates a certification scoped to the resolved profile', async () => {
    const dto = {
      name: 'CKAD',
      issuer: 'CNCF',
      issueDate: '2024-01-01',
    };

    await service.create(userId, dto);

    expect(certificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 'profile-1', name: 'CKAD' }),
    );
  });

  it('lists only certifications for the resolved profile', async () => {
    certificationRepo.find.mockResolvedValue([]);

    await service.listMine(userId);

    expect(certificationRepo.find).toHaveBeenCalledWith({
      where: { profileId: 'profile-1' },
      order: { issueDate: 'DESC' },
    });
  });

  it('scopes update by (id, profileId) in a single query, never load-then-check', async () => {
    certificationRepo.findOne.mockResolvedValue({
      id: 'cert-1',
      profileId: 'profile-1',
    });

    await service.update(userId, 'cert-1', { name: 'Renamed' });

    expect(certificationRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'cert-1', profileId: 'profile-1' },
    });
  });

  it('throws NotFoundException updating a certification belonging to another profile', async () => {
    certificationRepo.findOne.mockResolvedValue(null);

    await expect(
      service.update(userId, 'someone-elses-cert', { name: 'x' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException deleting a certification belonging to another profile', async () => {
    certificationRepo.delete.mockResolvedValue({ affected: 0 });

    await expect(service.remove(userId, 'someone-elses-cert')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deletes scoped by (id, profileId) on success', async () => {
    certificationRepo.delete.mockResolvedValue({ affected: 1 });

    await service.remove(userId, 'cert-1');

    expect(certificationRepo.delete).toHaveBeenCalledWith({
      id: 'cert-1',
      profileId: 'profile-1',
    });
  });

  // ── URL validation (DTO boundary) ─────────────────────────────────────

  describe('CreateCertificationDto credentialUrl validation', () => {
    async function errorsFor(payload: Record<string, unknown>) {
      const dto = plainToInstance(CreateCertificationDto, payload);
      return validate(dto);
    }

    it('accepts a valid https credential URL', async () => {
      const errors = await errorsFor({
        name: 'AWS SAA',
        issuer: 'AWS',
        issueDate: '2024-03-01',
        credentialUrl: 'https://verify.aws/abc',
      });
      expect(errors).toHaveLength(0);
    });

    it('accepts a missing credential URL (optional)', async () => {
      const errors = await errorsFor({
        name: 'AWS SAA',
        issuer: 'AWS',
        issueDate: '2024-03-01',
      });
      expect(errors).toHaveLength(0);
    });

    it('rejects a credential URL without a protocol', async () => {
      const errors = await errorsFor({
        name: 'AWS SAA',
        issuer: 'AWS',
        issueDate: '2024-03-01',
        credentialUrl: 'verify.aws/abc',
      });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('credentialUrl');
    });

    it('rejects when required fields are missing', async () => {
      const errors = await errorsFor({ credentialUrl: 'https://verify.aws' });
      const props = errors.map((e) => e.property);
      expect(props).toEqual(
        expect.arrayContaining(['name', 'issuer', 'issueDate']),
      );
    });
  });
});
