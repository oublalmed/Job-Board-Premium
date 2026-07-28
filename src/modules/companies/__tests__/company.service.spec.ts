import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CompanyService } from '../company.service.js';
import { Company } from '../entities/company.entity.js';
import { Recruiter } from '../entities/recruiter.entity.js';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../entities/subscription.entity.js';
import { UsersService } from '../../users/users.service.js';
import { SettingsService } from '../../settings/settings.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../../common/enums/audit-action.enum.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('CompanyService', () => {
  let service: CompanyService;
  let companyRepo: Record<string, jest.Mock>;
  let recruiterRepo: Record<string, jest.Mock>;
  let subscriptionRepo: Record<string, jest.Mock>;
  let usersService: Record<string, jest.Mock>;
  let settingsService: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;

  const userId = 'user-1';
  const dto = { name: 'Acme Corp', ice: '000000000000001' };

  const verifiedUser = {
    id: userId,
    email: 'recruiter@acme.ma',
    emailVerified: true,
    roles: [Role.RECRUITER],
  };

  beforeEach(async () => {
    companyRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((e: Record<string, unknown>) => ({
        id: 'company-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...e,
      })),
      save: jest
        .fn()
        .mockImplementation((e: Record<string, unknown>) => Promise.resolve(e)),
    };

    recruiterRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((e: Record<string, unknown>) => ({
        id: 'recruiter-1',
        createdAt: new Date(),
        ...e,
      })),
      save: jest
        .fn()
        .mockImplementation((e: Record<string, unknown>) => Promise.resolve(e)),
    };

    subscriptionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((e: Record<string, unknown>) => ({
        id: 'subscription-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...e,
      })),
      save: jest
        .fn()
        .mockImplementation((e: Record<string, unknown>) => Promise.resolve(e)),
    };

    usersService = {
      findById: jest.fn().mockResolvedValue({ ...verifiedUser }),
      update: jest.fn().mockResolvedValue(undefined),
    };

    settingsService = {
      getNumber: jest.fn().mockImplementation((key: string) => {
        if (key === 'trial_duration_days') return Promise.resolve(14);
        if (key === 'plan_starter_contacts') return Promise.resolve(15);
        return Promise.resolve(null);
      }),
    };

    auditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyService,
        { provide: getRepositoryToken(Company), useValue: companyRepo },
        { provide: getRepositoryToken(Recruiter), useValue: recruiterRepo },
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionRepo,
        },
        { provide: UsersService, useValue: usersService },
        { provide: SettingsService, useValue: settingsService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(CompanyService);
  });

  describe('EF-RECR-01 — Scenario 1: création nominale', () => {
    it('should create a company, link the caller as recruiter, promote to company_admin and provision a trial subscription', async () => {
      const result = await service.createCompany(userId, dto);

      expect(companyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Acme Corp', ice: dto.ice }),
      );
      expect(recruiterRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId, companyId: 'company-1' }),
      );
      expect(usersService.update).toHaveBeenCalledWith(userId, {
        roles: [Role.RECRUITER, Role.COMPANY_ADMIN],
      });
      expect(result.subscription).toEqual(
        expect.objectContaining({
          plan: SubscriptionPlan.STARTER,
          status: SubscriptionStatus.TRIAL,
          contactQuota: 15,
        }),
      );
    });

    it('should not duplicate the company_admin role if the user already has it', async () => {
      usersService.findById.mockResolvedValue({
        ...verifiedUser,
        roles: [Role.RECRUITER, Role.COMPANY_ADMIN],
      });

      await service.createCompany(userId, dto);

      expect(usersService.update).not.toHaveBeenCalled();
    });

    it('should set the trial endsAt to createdAt + trial_duration_days', async () => {
      const before = Date.now();
      const result = await service.createCompany(userId, dto);
      const after = Date.now();

      const endsAt = (result.subscription!.endsAt as Date).getTime();
      const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

      expect(endsAt).toBeGreaterThanOrEqual(before + fourteenDaysMs - 1000);
      expect(endsAt).toBeLessThanOrEqual(after + fourteenDaysMs + 1000);
    });

    it('should read trial duration and starter quota from settings with env fallback keys', async () => {
      await service.createCompany(userId, dto);

      expect(settingsService.getNumber).toHaveBeenCalledWith(
        'trial_duration_days',
        'TRIAL_DURATION_DAYS',
      );
      expect(settingsService.getNumber).toHaveBeenCalledWith(
        'plan_starter_contacts',
        'PLAN_STARTER_CONTACTS',
      );
    });

    it('should fall back to hardcoded defaults when settings return null', async () => {
      settingsService.getNumber.mockResolvedValue(null);

      const result = await service.createCompany(userId, dto);

      expect(result.subscription!.contactQuota).toBe(15);
      const endsAt = (result.subscription!.endsAt as Date).getTime();
      const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
      expect(endsAt).toBeGreaterThan(Date.now() + fourteenDaysMs - 5000);
    });

    it('should log COMPANY_CREATED in audit', async () => {
      await service.createCompany(userId, dto);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: userId,
          action: AuditAction.COMPANY_CREATED,
          entityType: 'company',
          entityId: 'company-1',
        }),
      );
    });
  });

  describe('EF-RECR-01 — Scenario 2: ICE déjà utilisé', () => {
    it('should reject with 409 when a company with this ICE already exists', async () => {
      companyRepo.findOne.mockResolvedValue({
        id: 'other-company',
        ice: dto.ice,
      });

      await expect(service.createCompany(userId, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(companyRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('EF-RECR-01 — Scenario 3: email non vérifié', () => {
    it('should reject with 403 when the user email is not verified', async () => {
      usersService.findById.mockResolvedValue({
        ...verifiedUser,
        emailVerified: false,
      });

      await expect(service.createCompany(userId, dto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(companyRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('EF-RECR-01 — Scenario 4: déjà rattaché à une entreprise', () => {
    it('should reject with 409 when the user already has a Recruiter record', async () => {
      recruiterRepo.findOne.mockResolvedValue({
        id: 'existing-recruiter',
        userId,
        companyId: 'some-other-company',
      });

      await expect(service.createCompany(userId, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(companyRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('EF-RECR-01 — error cases', () => {
    it('should throw NotFoundException if the user does not exist', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.createCompany(userId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('GET /companies/me', () => {
    it('should return the caller company and its subscription', async () => {
      recruiterRepo.findOne.mockResolvedValue({
        id: 'recruiter-1',
        userId,
        companyId: 'company-1',
        company: { id: 'company-1', name: 'Acme Corp' },
      });
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'subscription-1',
        companyId: 'company-1',
        status: SubscriptionStatus.TRIAL,
      });

      const result = await service.getMyCompany(userId);

      expect(result.company).toEqual(
        expect.objectContaining({ id: 'company-1', name: 'Acme Corp' }),
      );
      expect(result.subscription).toEqual(
        expect.objectContaining({ status: SubscriptionStatus.TRIAL }),
      );
    });

    it('should throw 404 when the user has no company', async () => {
      recruiterRepo.findOne.mockResolvedValue(null);

      await expect(service.getMyCompany(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
