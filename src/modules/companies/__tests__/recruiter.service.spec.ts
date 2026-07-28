import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RecruiterService } from '../recruiter.service.js';
import { Recruiter } from '../entities/recruiter.entity.js';
import { UsersService } from '../../users/users.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../../common/enums/audit-action.enum.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('RecruiterService', () => {
  let service: RecruiterService;
  let recruiterRepo: Record<string, jest.Mock>;
  let usersService: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;

  const callerId = 'admin-1';
  const companyId = 'company-1';

  const callerRecruiter = {
    id: 'recruiter-admin',
    userId: callerId,
    companyId,
  };

  const targetUser = {
    id: 'target-1',
    email: 'newrecruiter@acme.ma',
    emailVerified: true,
    roles: [Role.CANDIDATE],
  };

  beforeEach(async () => {
    recruiterRepo = {
      findOne: jest
        .fn()
        .mockImplementation(({ where }: { where: Record<string, unknown> }) => {
          if (where.userId === callerId)
            return Promise.resolve(callerRecruiter);
          return Promise.resolve(null);
        }),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((e: Record<string, unknown>) => ({
        id: 'recruiter-new',
        createdAt: new Date(),
        ...e,
      })),
      save: jest
        .fn()
        .mockImplementation((e: Record<string, unknown>) => Promise.resolve(e)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    usersService = {
      findByEmail: jest.fn().mockResolvedValue({ ...targetUser }),
      findById: jest.fn().mockResolvedValue({ ...targetUser }),
      update: jest.fn().mockResolvedValue(undefined),
    };

    auditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecruiterService,
        { provide: getRepositoryToken(Recruiter), useValue: recruiterRepo },
        { provide: UsersService, useValue: usersService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(RecruiterService);
  });

  describe('EF-RECR-02 — Scenario 1: ajout nominal', () => {
    it('should add an existing verified user as recruiter of the caller company', async () => {
      const result = await service.addRecruiter(callerId, {
        email: 'newrecruiter@acme.ma',
      });

      expect(recruiterRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: targetUser.id, companyId }),
      );
      expect(usersService.update).toHaveBeenCalledWith(targetUser.id, {
        roles: [Role.CANDIDATE, Role.RECRUITER],
      });
      expect(result.id).toBe('recruiter-new');
    });

    it('should not duplicate the recruiter role if the target already has it', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...targetUser,
        roles: [Role.RECRUITER],
      });

      await service.addRecruiter(callerId, { email: 'newrecruiter@acme.ma' });

      expect(usersService.update).not.toHaveBeenCalled();
    });

    it('should log RECRUITER_ADDED in audit', async () => {
      await service.addRecruiter(callerId, { email: 'newrecruiter@acme.ma' });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: callerId,
          action: AuditAction.RECRUITER_ADDED,
          entityType: 'recruiter',
        }),
      );
    });
  });

  describe('EF-RECR-02 — Scenario 2: erreurs ajout', () => {
    it('rejects 404 when the target email has no account', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.addRecruiter(callerId, { email: 'ghost@acme.ma' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects 403 when the target email is not verified', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...targetUser,
        emailVerified: false,
      });

      await expect(
        service.addRecruiter(callerId, { email: 'unverified@acme.ma' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects 409 when the target user is already attached to a company', async () => {
      recruiterRepo.findOne.mockImplementation(
        ({ where }: { where: Record<string, unknown> }) => {
          if (where.userId === callerId)
            return Promise.resolve(callerRecruiter);
          if (where.userId === targetUser.id)
            return Promise.resolve({
              id: 'existing',
              userId: targetUser.id,
              companyId: 'other-company',
            });
          return Promise.resolve(null);
        },
      );

      await expect(
        service.addRecruiter(callerId, { email: 'newrecruiter@acme.ma' }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects 404 when the caller has no company', async () => {
      recruiterRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addRecruiter(callerId, { email: 'newrecruiter@acme.ma' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('EF-RECR-02 — Scenario 3: liste des recruteurs', () => {
    it("returns only the caller's own company recruiters", async () => {
      recruiterRepo.find.mockResolvedValue([
        {
          id: 'r1',
          userId: 'u1',
          companyId,
          position: 'Talent lead',
          createdAt: new Date(),
          user: { email: 'r1@acme.ma' },
        },
      ]);

      const result = await service.listRecruiters(callerId);

      expect(recruiterRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId } }),
      );
      expect(result).toEqual([
        expect.objectContaining({ id: 'r1', email: 'r1@acme.ma' }),
      ]);
    });
  });

  describe('EF-RECR-02 — Scenario 4: retrait', () => {
    it('should remove a recruiter and strip their recruiter/company_admin roles', async () => {
      recruiterRepo.findOne.mockImplementation(
        ({ where }: { where: Record<string, unknown> }) => {
          if (where.userId === callerId)
            return Promise.resolve(callerRecruiter);
          if (where.id === 'recruiter-x')
            return Promise.resolve({
              id: 'recruiter-x',
              userId: 'other-user',
              companyId,
            });
          return Promise.resolve(null);
        },
      );
      usersService.findById.mockResolvedValue({
        id: 'other-user',
        roles: [Role.CANDIDATE, Role.RECRUITER],
      });

      await service.removeRecruiter(callerId, 'recruiter-x');

      expect(recruiterRepo.delete).toHaveBeenCalledWith({ id: 'recruiter-x' });
      expect(usersService.update).toHaveBeenCalledWith('other-user', {
        roles: [Role.CANDIDATE],
      });
    });

    it('rejects 409 when the company_admin tries to remove themselves', async () => {
      recruiterRepo.findOne.mockImplementation(
        ({ where }: { where: Record<string, unknown> }) => {
          if (where.userId === callerId)
            return Promise.resolve(callerRecruiter);
          if (where.id === callerRecruiter.id)
            return Promise.resolve(callerRecruiter);
          return Promise.resolve(null);
        },
      );

      await expect(
        service.removeRecruiter(callerId, callerRecruiter.id),
      ).rejects.toThrow(ConflictException);
      expect(recruiterRepo.delete).not.toHaveBeenCalled();
    });

    it('rejects 404 when the target recruiter belongs to another company (isolation)', async () => {
      recruiterRepo.findOne.mockImplementation(
        ({ where }: { where: Record<string, unknown> }) => {
          if (where.userId === callerId)
            return Promise.resolve(callerRecruiter);
          if (where.id === 'foreign-recruiter')
            return Promise.resolve({
              id: 'foreign-recruiter',
              userId: 'someone-else',
              companyId: 'company-B',
            });
          return Promise.resolve(null);
        },
      );

      await expect(
        service.removeRecruiter(callerId, 'foreign-recruiter'),
      ).rejects.toThrow(NotFoundException);
      expect(recruiterRepo.delete).not.toHaveBeenCalled();
    });

    it('rejects 404 when the target recruiter does not exist', async () => {
      recruiterRepo.findOne.mockImplementation(
        ({ where }: { where: Record<string, unknown> }) => {
          if (where.userId === callerId)
            return Promise.resolve(callerRecruiter);
          return Promise.resolve(null);
        },
      );

      await expect(
        service.removeRecruiter(callerId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
