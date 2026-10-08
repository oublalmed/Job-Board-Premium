import {
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { RecruiterInvitationService } from '../recruiter-invitation.service.js';
import { Role } from '../../../common/enums/role.enum.js';

type M = Record<string, jest.Mock>;

describe('RecruiterInvitationService', () => {
  let service: RecruiterInvitationService;
  let invitationRepo: M;
  let recruiterRepo: M;
  let companyRepo: M;
  let subscriptionGuard: M;
  let usersService: M;
  let auditService: M;
  let mailProvider: M;

  const callerId = 'admin-1';
  const companyId = 'company-1';

  beforeEach(() => {
    invitationRepo = {
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
      create: jest.fn().mockImplementation((e) => ({ id: 'inv-1', ...e })),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    recruiterRepo = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((e) => ({ id: 'rec-1', ...e })),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    };
    companyRepo = {
      findOne: jest.fn().mockResolvedValue({ id: companyId, name: 'Acme' }),
    };
    subscriptionGuard = {
      resolveCompanyId: jest.fn().mockResolvedValue(companyId),
      getSeatLimit: jest.fn().mockResolvedValue(3),
    };
    usersService = {
      findByEmail: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue({ id: 'u-new', roles: [] }),
      create: jest
        .fn()
        .mockImplementation((d) => Promise.resolve({ id: 'u-new', ...d })),
      update: jest.fn().mockResolvedValue(undefined),
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    mailProvider = {
      send: jest.fn().mockResolvedValue({ messageId: 'm1' }),
    };

    service = new RecruiterInvitationService(
      invitationRepo as never,
      recruiterRepo as never,
      companyRepo as never,
      subscriptionGuard as never,
      usersService as never,
      auditService as never,
      mailProvider as never,
    );
  });

  it('creates a pending invitation and emails a new address', async () => {
    const result = await service.invite(callerId, { email: 'New@Acme.ma' });

    expect(result).toEqual({ status: 'invited' });
    const saved = invitationRepo.save.mock.calls[0][0];
    expect(saved.email).toBe('new@acme.ma'); // lowercased
    expect(saved.tokenHash).toMatch(/^[a-f0-9]{64}$/); // sha256, never raw
    expect(mailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 'recruiter-invitation' }),
    );
  });

  it('attaches an existing verified user directly (no invite)', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'u-2',
      emailVerified: true,
      roles: [Role.CANDIDATE],
    });
    usersService.findById.mockResolvedValue({ id: 'u-2', roles: [Role.CANDIDATE] });

    const result = await service.invite(callerId, { email: 'known@acme.ma' });

    expect(result).toEqual({ status: 'attached' });
    expect(recruiterRepo.save).toHaveBeenCalled();
    expect(mailProvider.send).not.toHaveBeenCalled();
  });

  it('rejects when the seat limit is reached', async () => {
    recruiterRepo.count.mockResolvedValue(3); // at the cap of 3

    await expect(
      service.invite(callerId, { email: 'late@acme.ma' }),
    ).rejects.toThrow(ForbiddenException);
    expect(invitationRepo.save).not.toHaveBeenCalled();
  });

  it('rejects inviting a user already attached to a company', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'u-3',
      emailVerified: true,
      roles: [Role.RECRUITER],
    });
    recruiterRepo.findOne.mockResolvedValue({ id: 'rec-x', userId: 'u-3' });

    await expect(
      service.invite(callerId, { email: 'taken@acme.ma' }),
    ).rejects.toThrow(ConflictException);
  });

  it('accept creates a new recruiter account from a valid token', async () => {
    invitationRepo.findOne.mockResolvedValue({
      id: 'inv-9',
      companyId,
      email: 'invitee@acme.ma',
      position: 'Lead',
      invitedById: callerId,
      status: 'pending',
    });

    const result = await service.accept('rawtoken', 'Password123!');

    expect(result.message).toMatch(/activé/i);
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'invitee@acme.ma',
        roles: [Role.RECRUITER],
        emailVerified: true,
      }),
    );
    expect(recruiterRepo.save).toHaveBeenCalled();
    // invitation consumed
    expect(invitationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'accepted' }),
    );
  });

  it('accept rejects an invalid/expired token', async () => {
    invitationRepo.findOne.mockResolvedValue(null);
    await expect(service.accept('bad', 'Password123!')).rejects.toThrow();
  });
});
