import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CandidateDataService } from '../candidate-data.service.js';
import { User, UserStatus } from '../../users/entities/user.entity.js';
import { CandidateProfile } from '../entities/candidate-profile.entity.js';
import { Experience, ExperienceType } from '../entities/experience.entity.js';
import { ProfileSkill } from '../entities/profile-skill.entity.js';
import { ProfileLink, LinkType } from '../entities/profile-link.entity.js';
import {
  Document,
  DocumentType,
  ScanStatus,
} from '../entities/document.entity.js';
import { OBJECT_STORAGE } from '../../../ports/object-storage.port.js';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../../common/enums/audit-action.enum.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('CandidateDataService', () => {
  let service: CandidateDataService;
  let userRepo: Record<string, jest.Mock>;
  let profileRepo: Record<string, jest.Mock>;
  let experienceRepo: Record<string, jest.Mock>;
  let profileSkillRepo: Record<string, jest.Mock>;
  let profileLinkRepo: Record<string, jest.Mock>;
  let documentRepo: Record<string, jest.Mock>;
  let objectStorage: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;

  const userId = 'user-001';

  const mockUser: Partial<User> = {
    id: userId,
    email: 'candidat@example.com',
    roles: [Role.CANDIDATE],
    status: UserStatus.ACTIVE,
    emailVerified: true,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-06-01'),
  };

  const mockProfile: Partial<CandidateProfile> = {
    id: 'profile-001',
    userId,
    firstName: 'Youssef',
    lastName: 'El Amrani',
    headline: 'Développeur Full Stack',
    bio: 'Passionné par le web',
    school: 'ENSIAS',
    completeness: 85,
    createdAt: new Date('2026-01-20'),
    updatedAt: new Date('2026-06-01'),
  };

  const mockExperiences: Partial<Experience>[] = [
    {
      id: 'exp-001',
      type: ExperienceType.WORK,
      title: 'Dev Backend',
      organization: 'TechCorp',
      startDate: '2023-01-01',
      endDate: '2025-12-31',
      description: 'Node.js & NestJS',
    },
  ];

  const mockProfileSkills: Partial<ProfileSkill>[] = [
    {
      id: 'ps-001',
      skill: { id: 'sk-001', name: 'TypeScript', category: 'backend' } as any,
      level: 'senior',
    },
  ];

  const mockLinks: Partial<ProfileLink>[] = [
    {
      id: 'link-001',
      type: LinkType.GITHUB,
      url: 'https://github.com/youssef',
      label: 'GitHub',
    },
  ];

  const mockDocuments: Partial<Document>[] = [
    {
      id: 'doc-001',
      type: DocumentType.CV,
      storageKey: 'cvs/user-001/cv.pdf',
      originalName: 'mon-cv.pdf',
      mimeType: 'application/pdf',
      size: 204800,
      scanStatus: ScanStatus.CLEAN,
      createdAt: new Date('2026-05-01'),
    },
  ];

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    profileRepo = {
      findOne: jest.fn(),
      remove: jest.fn(),
    };
    experienceRepo = { find: jest.fn() };
    profileSkillRepo = { find: jest.fn() };
    profileLinkRepo = { find: jest.fn() };
    documentRepo = {
      find: jest.fn(),
      remove: jest.fn(),
    };
    objectStorage = { delete: jest.fn().mockResolvedValue(undefined) };
    auditService = { log: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidateDataService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        {
          provide: getRepositoryToken(CandidateProfile),
          useValue: profileRepo,
        },
        { provide: getRepositoryToken(Experience), useValue: experienceRepo },
        {
          provide: getRepositoryToken(ProfileSkill),
          useValue: profileSkillRepo,
        },
        { provide: getRepositoryToken(ProfileLink), useValue: profileLinkRepo },
        { provide: getRepositoryToken(Document), useValue: documentRepo },
        { provide: OBJECT_STORAGE, useValue: objectStorage },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(CandidateDataService);
  });

  // ── Export ──────────────────────────────────────────────────────────

  describe('exportData', () => {
    it('should export all candidate data as structured JSON', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      profileRepo.findOne.mockResolvedValue(mockProfile);
      experienceRepo.find.mockResolvedValue(mockExperiences);
      profileSkillRepo.find.mockResolvedValue(mockProfileSkills);
      profileLinkRepo.find.mockResolvedValue(mockLinks);
      documentRepo.find.mockResolvedValue(mockDocuments);

      const result = await service.exportData(userId);

      expect(result).toHaveProperty('exportDate');
      expect(result.user.email).toBe('candidat@example.com');
      expect(result.user.roles).toEqual([Role.CANDIDATE]);
      expect(result.profile.firstName).toBe('Youssef');
      expect(result.profile.lastName).toBe('El Amrani');
      expect(result.experiences).toHaveLength(1);
      expect(result.experiences[0].title).toBe('Dev Backend');
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].name).toBe('TypeScript');
      expect(result.links).toHaveLength(1);
      expect(result.links[0].url).toBe('https://github.com/youssef');
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].originalName).toBe('mon-cv.pdf');
    });

    it('should NOT include passwordHash or tokens in export', async () => {
      userRepo.findOne.mockResolvedValue({
        ...mockUser,
        passwordHash: '$argon2id$secret',
        emailVerificationToken: 'token-123',
      });
      profileRepo.findOne.mockResolvedValue(mockProfile);
      experienceRepo.find.mockResolvedValue([]);
      profileSkillRepo.find.mockResolvedValue([]);
      profileLinkRepo.find.mockResolvedValue([]);
      documentRepo.find.mockResolvedValue([]);

      const result = await service.exportData(userId);

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).not.toHaveProperty('emailVerificationToken');
      expect(result.user).not.toHaveProperty('emailVerificationExpires');
    });

    it('should log export action in audit', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      profileRepo.findOne.mockResolvedValue(null);
      experienceRepo.find.mockResolvedValue([]);
      profileSkillRepo.find.mockResolvedValue([]);
      profileLinkRepo.find.mockResolvedValue([]);
      documentRepo.find.mockResolvedValue([]);

      await service.exportData(userId);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: userId,
          action: AuditAction.USER_DATA_EXPORTED,
          entityType: 'User',
          entityId: userId,
        }),
      );
    });

    it('should throw NotFoundException if user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.exportData(userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should export with empty profile and no related data', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      profileRepo.findOne.mockResolvedValue(null);
      experienceRepo.find.mockResolvedValue([]);
      profileSkillRepo.find.mockResolvedValue([]);
      profileLinkRepo.find.mockResolvedValue([]);
      documentRepo.find.mockResolvedValue([]);

      const result = await service.exportData(userId);

      expect(result.user.email).toBe('candidat@example.com');
      expect(result.profile).toBeNull();
      expect(result.experiences).toEqual([]);
      expect(result.skills).toEqual([]);
      expect(result.links).toEqual([]);
      expect(result.documents).toEqual([]);
    });
  });

  // ── Deletion ───────────────────────────────────────────────────────

  describe('deleteData', () => {
    it('should anonymize user and delete all personal data', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser });
      profileRepo.findOne.mockResolvedValue(mockProfile);
      documentRepo.find.mockResolvedValue(mockDocuments);

      await service.deleteData(userId);

      expect(objectStorage.delete).toHaveBeenCalledWith('cvs/user-001/cv.pdf');
      expect(documentRepo.remove).toHaveBeenCalledWith(mockDocuments);
      expect(profileRepo.remove).toHaveBeenCalledWith(mockProfile);
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: UserStatus.DELETED,
          emailVerified: false,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        }),
      );
    });

    it('should anonymize email with non-reversible value', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser });
      profileRepo.findOne.mockResolvedValue(null);
      documentRepo.find.mockResolvedValue([]);

      await service.deleteData(userId);

      const savedUser = userRepo.save.mock.calls[0][0];
      expect(savedUser.email).toMatch(/^deleted_[a-f0-9-]+@anonymized\.local$/);
      expect(savedUser.email).not.toBe('candidat@example.com');
    });

    it('should wipe passwordHash', async () => {
      userRepo.findOne.mockResolvedValue({
        ...mockUser,
        passwordHash: '$argon2id$secret',
      });
      profileRepo.findOne.mockResolvedValue(null);
      documentRepo.find.mockResolvedValue([]);

      await service.deleteData(userId);

      const savedUser = userRepo.save.mock.calls[0][0];
      expect(savedUser.passwordHash).toBe('');
    });

    it('should delete multiple documents from object storage', async () => {
      const docs = [
        { ...mockDocuments[0], storageKey: 'cvs/user-001/cv1.pdf' },
        {
          ...mockDocuments[0],
          id: 'doc-002',
          storageKey: 'cvs/user-001/cv2.pdf',
        },
      ];
      userRepo.findOne.mockResolvedValue({ ...mockUser });
      profileRepo.findOne.mockResolvedValue(null);
      documentRepo.find.mockResolvedValue(docs);

      await service.deleteData(userId);

      expect(objectStorage.delete).toHaveBeenCalledTimes(2);
      expect(objectStorage.delete).toHaveBeenCalledWith('cvs/user-001/cv1.pdf');
      expect(objectStorage.delete).toHaveBeenCalledWith('cvs/user-001/cv2.pdf');
    });

    it('should proceed with deletion even if storage delete fails', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser });
      profileRepo.findOne.mockResolvedValue(mockProfile);
      documentRepo.find.mockResolvedValue(mockDocuments);
      objectStorage.delete.mockRejectedValue(new Error('storage unreachable'));

      await service.deleteData(userId);

      expect(documentRepo.remove).toHaveBeenCalled();
      expect(profileRepo.remove).toHaveBeenCalled();
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('should log deletion action in audit', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser });
      profileRepo.findOne.mockResolvedValue(null);
      documentRepo.find.mockResolvedValue([]);

      await service.deleteData(userId);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: userId,
          action: AuditAction.USER_DELETED,
          entityType: 'User',
          entityId: userId,
        }),
      );
    });

    it('should throw NotFoundException if user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteData(userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should work when user has no profile and no documents', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser });
      profileRepo.findOne.mockResolvedValue(null);
      documentRepo.find.mockResolvedValue([]);

      await expect(service.deleteData(userId)).resolves.not.toThrow();

      expect(profileRepo.remove).not.toHaveBeenCalled();
      expect(objectStorage.delete).not.toHaveBeenCalled();
      expect(userRepo.save).toHaveBeenCalled();
    });
  });
});
