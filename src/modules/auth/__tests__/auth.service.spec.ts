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
          useValue: { sign: jest.fn().mockReturnValue('mock-jwt-token') },
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
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should only allow candidate or recruiter roles on registration', async () => {
      usersService['findByEmail'].mockResolvedValue(null);
      usersService['create'].mockResolvedValue(mockUser);

      await service.register({
        email: 'new@example.com',
        password: 'StrongP@ss1',
        roles: [Role.ADMIN, Role.CANDIDATE],
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

      const result = await service.login({
        email: 'test@example.com',
        password: 'Test1234!@',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
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

  describe('verifyEmail', () => {
    it('should throw BadRequestException for invalid token', async () => {
      refreshTokenRepo['manager'].find.mockResolvedValue([]);

      await expect(service.verifyEmail('bad-token')).rejects.toThrow(
        BadRequestException,
      );
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
  });
});
