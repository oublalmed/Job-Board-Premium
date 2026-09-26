import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from '../auth.service.js';
import { MfaService } from '../mfa.service.js';
import { ReferralService } from '../../growth/referral.service.js';
import { UsersService } from '../../users/users.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { RefreshToken } from '../../users/entities/refresh-token.entity.js';
import { User, UserStatus } from '../../users/entities/user.entity.js';
import { Role } from '../../../common/enums/role.enum.js';
import { MAIL_PROVIDER } from '../../../ports/mail.port.js';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Record<string, jest.Mock>;
  let refreshTokenRepo: Record<string, any>;
  let mailProvider: Record<string, jest.Mock>;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    passwordHash: '',
    roles: [Role.CANDIDATE],
    status: UserStatus.ACTIVE,
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    mfaEnabled: false,
    mfaSecret: null,
    mfaBackupCodes: null,
    consentAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    refreshTokens: [],
  };

  beforeEach(async () => {
    mockUser.passwordHash = await argon2.hash('Test1234!@', {
      type: argon2.argon2id,
    });

    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    refreshTokenRepo = {
      findOne: jest.fn(),
      save: jest
        .fn()
        .mockImplementation((entity: any) =>
          Promise.resolve({ id: 'token-id', ...entity }),
        ),
      create: jest.fn().mockImplementation((entity: any) => entity),
      update: jest.fn(),
      delete: jest.fn(),
      manager: { find: jest.fn() },
    };

    mailProvider = {
      send: jest.fn().mockResolvedValue({ messageId: 'msg-123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest
              .fn()
              .mockReturnValue({ sub: mockUser.id, purpose: 'mfa_challenge' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-value'),
            getOrThrow: jest.fn().mockImplementation((key: string) => {
              const config: Record<string, string> = {
                'auth.jwtAccessSecret': 'test-access-secret-32chars-long',
                'auth.jwtAccessExpiration': '15m',
                'auth.jwtRefreshSecret': 'test-refresh-secret-32chars-long',
                'auth.jwtRefreshExpiration': '7d',
              };
              return config[key] ?? 'test-value';
            }),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokenRepo,
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn().mockResolvedValue({}) },
        },
        { provide: MAIL_PROVIDER, useValue: mailProvider },
        {
          provide: ReferralService,
          useValue: {
            recordSignup: jest.fn().mockResolvedValue(undefined),
            markConverted: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: MfaService,
          useValue: {
            verifyForLogin: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a new user and send verification email', async () => {
      usersService['findByEmail'].mockResolvedValue(null);
      usersService['create'].mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'new@example.com',
        password: 'StrongP@ss1',
        consentAccepted: true,
      });

      expect(result.user.email).toBe(mockUser.email);
      expect(result.message).toContain('verify');
      expect(mailProvider['send']).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          templateId: 'email-verification',
        }),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      usersService['findByEmail'].mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'StrongP@ss1',
          consentAccepted: true,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('forces candidate-only on self-registration, ignoring any requested elevated role', async () => {
      usersService['findByEmail'].mockResolvedValue(null);
      usersService['create'].mockResolvedValue(mockUser);

      // Recruiters are provisioned by an admin — a self-registrant who asks for
      // RECRUITER (or ADMIN) is still created as a plain candidate.
      await service.register({
        email: 'new@example.com',
        password: 'StrongP@ss1',
        roles: [Role.ADMIN, Role.RECRUITER],
        consentAccepted: true,
      });

      expect(usersService['create']).toHaveBeenCalledWith(
        expect.objectContaining({
          roles: [Role.CANDIDATE],
        }),
      );
    });
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      usersService['findByEmail'].mockResolvedValue(mockUser);

      const result = (await service.login({
        email: 'test@example.com',
        password: 'Test1234!@',
      })) as { accessToken?: string; refreshToken?: string };

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should return an MFA challenge (not tokens) when MFA is enabled', async () => {
      const mfaUser = { ...mockUser, mfaEnabled: true };
      usersService['findByEmail'].mockResolvedValue(mfaUser);

      const result = (await service.login({
        email: 'test@example.com',
        password: 'Test1234!@',
      })) as { mfaRequired?: boolean; mfaToken?: string; accessToken?: string };

      expect(result.mfaRequired).toBe(true);
      expect(result.mfaToken).toBeDefined();
      expect(result.accessToken).toBeUndefined();
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      usersService['findByEmail'].mockResolvedValue(mockUser);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'WrongPassword1!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if email not verified', async () => {
      const unverifiedUser = { ...mockUser, emailVerified: false };
      usersService['findByEmail'].mockResolvedValue(unverifiedUser);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'Test1234!@',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      usersService['findByEmail'].mockResolvedValue(null);

      await expect(
        service.login({
          email: 'notexist@example.com',
          password: 'Test1234!@',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if account is suspended', async () => {
      const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED };
      usersService['findByEmail'].mockResolvedValue(suspendedUser);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'Test1234!@',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyMfaChallenge', () => {
    it('issues MFA-authenticated tokens when the code is valid', async () => {
      const mfaUser = { ...mockUser, mfaEnabled: true };
      usersService['findById'].mockResolvedValue(mfaUser);

      const result = await service.verifyMfaChallenge('challenge', '123456');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('rejects an invalid code', async () => {
      const mfaUser = { ...mockUser, mfaEnabled: true };
      usersService['findById'].mockResolvedValue(mfaUser);
      (service as unknown as { mfaService: { verifyForLogin: jest.Mock } })[
        'mfaService'
      ].verifyForLogin.mockResolvedValueOnce(false);

      await expect(
        service.verifyMfaChallenge('challenge', '000000'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a challenge for a user without MFA enabled', async () => {
      usersService['findById'].mockResolvedValue(mockUser); // mfaEnabled false

      await expect(
        service.verifyMfaChallenge('challenge', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email and activate user', async () => {
      const unverifiedUser = {
        ...mockUser,
        status: UserStatus.PENDING_VERIFICATION,
        emailVerified: false,
        emailVerificationToken: 'valid-token',
        emailVerificationExpires: new Date(Date.now() + 86400000),
      };
      refreshTokenRepo['manager'].find.mockResolvedValue([unverifiedUser]);
      usersService['update'].mockResolvedValue(undefined);

      const result = await service.verifyEmail('valid-token');

      expect(result.message).toContain('verified');
      expect(usersService['update']).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          emailVerified: true,
          status: UserStatus.ACTIVE,
          emailVerificationToken: null,
        }),
      );
    });

    it('should throw BadRequestException for invalid token', async () => {
      refreshTokenRepo['manager'].find.mockResolvedValue([]);

      await expect(service.verifyEmail('bad-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for expired token', async () => {
      const expiredUser = {
        ...mockUser,
        emailVerificationToken: 'expired-token',
        emailVerificationExpires: new Date(Date.now() - 86400000),
      };
      refreshTokenRepo['manager'].find.mockResolvedValue([expiredUser]);

      await expect(service.verifyEmail('expired-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('requestPasswordReset (EF-CAND-01)', () => {
    it('issues a hashed token and emails the raw one for an active account', async () => {
      usersService['findByEmail'].mockResolvedValue(mockUser);

      const result = await service.requestPasswordReset('Test@Example.com');

      expect(result.message).toMatch(/if an account exists/i);
      // Lower-cased lookup.
      expect(usersService['findByEmail']).toHaveBeenCalledWith(
        'test@example.com',
      );
      // Stored token is a sha256 hash (64 hex chars), never the raw value.
      const updateArg = usersService['update'].mock.calls[0][1] as {
        passwordResetToken: string;
        passwordResetExpires: Date;
      };
      expect(updateArg.passwordResetToken).toMatch(/^[a-f0-9]{64}$/);
      expect(updateArg.passwordResetExpires.getTime()).toBeGreaterThan(
        Date.now(),
      );
      const mailArg = mailProvider['send'].mock.calls[0][0] as {
        templateId: string;
        variables: { token: string };
      };
      expect(mailArg.templateId).toBe('password-reset');
      // The emailed token is the RAW token, not the stored hash.
      expect(mailArg.variables.token).not.toBe(updateArg.passwordResetToken);
    });

    it('returns the same message and does nothing when the email is unknown (no enumeration)', async () => {
      usersService['findByEmail'].mockResolvedValue(null);

      const result = await service.requestPasswordReset('ghost@example.com');

      expect(result.message).toMatch(/if an account exists/i);
      expect(usersService['update']).not.toHaveBeenCalled();
      expect(mailProvider['send']).not.toHaveBeenCalled();
    });

    it('does not issue a token for an unverified account', async () => {
      usersService['findByEmail'].mockResolvedValue({
        ...mockUser,
        emailVerified: false,
      });

      await service.requestPasswordReset('test@example.com');

      expect(usersService['update']).not.toHaveBeenCalled();
      expect(mailProvider['send']).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword (EF-CAND-01)', () => {
    it('sets a new password, clears the token, and revokes all sessions', async () => {
      const future = new Date(Date.now() + 60 * 60 * 1000);
      refreshTokenRepo['manager'].find.mockResolvedValue([
        { ...mockUser, passwordResetExpires: future },
      ]);

      const result = await service.resetPassword('raw-token', 'NewStr0ng!Pass');

      expect(result.message).toMatch(/reset/i);
      const updateArg = usersService['update'].mock.calls[0][1] as {
        passwordHash: string;
        passwordResetToken: string | null;
      };
      expect(updateArg.passwordHash).toBeDefined();
      expect(updateArg.passwordResetToken).toBeNull();
      // All refresh tokens revoked (session invalidation on reset).
      expect(refreshTokenRepo['update']).toHaveBeenCalledWith(
        { userId: mockUser.id, revoked: false },
        { revoked: true },
      );
    });

    it('rejects an invalid or expired token', async () => {
      refreshTokenRepo['manager'].find.mockResolvedValue([]);

      await expect(
        service.resetPassword('bad-token', 'NewStr0ng!Pass'),
      ).rejects.toThrow(BadRequestException);
      expect(usersService['update']).not.toHaveBeenCalled();
    });
  });

  describe('refreshTokens', () => {
    it('should throw UnauthorizedException for invalid token', async () => {
      refreshTokenRepo['findOne'].mockResolvedValue(null);

      await expect(service.refreshTokens('invalid')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should revoke all tokens on reuse detection', async () => {
      const revokedToken = {
        id: 'tok-1',
        tokenHash: 'hash',
        userId: mockUser.id,
        user: mockUser,
        expiresAt: new Date(Date.now() + 86400000),
        revoked: true,
        replacedBy: null,
        createdAt: new Date(),
      };

      refreshTokenRepo['findOne'].mockResolvedValue(revokedToken);

      await expect(service.refreshTokens('reused-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshTokenRepo['update']).toHaveBeenCalledWith(
        { userId: mockUser.id, revoked: false },
        { revoked: true },
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      const expiredToken = {
        id: 'tok-1',
        tokenHash: 'hash',
        userId: mockUser.id,
        user: mockUser,
        expiresAt: new Date(Date.now() - 86400000),
        revoked: false,
        replacedBy: null,
        createdAt: new Date(),
      };

      refreshTokenRepo['findOne'].mockResolvedValue(expiredToken);

      await expect(service.refreshTokens('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should rotate tokens successfully', async () => {
      const validToken = {
        id: 'tok-1',
        tokenHash: 'hash',
        userId: mockUser.id,
        user: mockUser,
        expiresAt: new Date(Date.now() + 86400000),
        revoked: false,
        replacedBy: null,
        createdAt: new Date(),
      };

      refreshTokenRepo['findOne'].mockResolvedValue(validToken);

      const result = await service.refreshTokens('valid-token');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(validToken.revoked).toBe(true);
      expect(refreshTokenRepo['save']).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens and return count', async () => {
      refreshTokenRepo['delete'] = jest.fn().mockResolvedValue({ affected: 5 });

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(5);
      expect(refreshTokenRepo['delete']).toHaveBeenCalled();
    });

    it('should return 0 when no expired tokens', async () => {
      refreshTokenRepo['delete'] = jest.fn().mockResolvedValue({ affected: 0 });

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(0);
    });
  });
});
