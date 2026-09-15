import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { MfaService } from '../mfa.service.js';
import { UsersService } from '../../users/users.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { User } from '../../users/entities/user.entity.js';
import { generateTotp } from '../../../common/crypto/totp.js';

describe('MfaService', () => {
  let service: MfaService;
  let user: User;
  let usersService: { findById: jest.Mock; update: jest.Mock };
  let auditService: { log: jest.Mock };

  const configValues: Record<string, string> = {
    'auth.mfaEncryptionKey': '',
    'auth.jwtRefreshSecret': 'unit-test-refresh-secret-value',
    'auth.mfaIssuer': 'Cobalt',
  };

  beforeEach(async () => {
    user = {
      id: 'user-1',
      email: 'admin@example.com',
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: null,
    } as User;

    usersService = {
      findById: jest.fn(() => Promise.resolve(user)),
      update: jest.fn((_id: string, data: Partial<User>) => {
        user = { ...user, ...data };
        return Promise.resolve(user);
      }),
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MfaService,
        { provide: UsersService, useValue: usersService },
        { provide: AuditService, useValue: auditService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: unknown) => configValues[key] ?? def,
            getOrThrow: (key: string) => configValues[key],
          },
        },
      ],
    }).compile();

    service = module.get(MfaService);
  });

  async function enroll(): Promise<{ secret: string; backupCodes: string[] }> {
    const { secret } = await service.beginSetup(user.id);
    const code = generateTotp(secret);
    const { backupCodes } = await service.enable(user.id, code);
    return { secret, backupCodes };
  }

  it('beginSetup stores an (encrypted) secret without enabling MFA', async () => {
    const { secret, otpauthUri } = await service.beginSetup(user.id);

    expect(secret).toHaveLength(32);
    expect(otpauthUri).toContain('otpauth://totp/Cobalt:admin%40example.com');
    expect(user.mfaEnabled).toBe(false);
    expect(user.mfaSecret).toBeTruthy();
    // Stored form must be encrypted, not the plaintext secret.
    expect(user.mfaSecret).not.toContain(secret);
  });

  it('enable rejects a wrong code and accepts a valid one', async () => {
    const { secret } = await service.beginSetup(user.id);
    await expect(service.enable(user.id, '000000')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const { backupCodes } = await service.enable(user.id, generateTotp(secret));
    expect(user.mfaEnabled).toBe(true);
    expect(backupCodes).toHaveLength(10);
    expect(user.mfaBackupCodes).toHaveLength(10);
    // Backup codes are stored hashed, never in plaintext.
    expect(user.mfaBackupCodes).not.toContain(backupCodes[0]);
  });

  it('enable requires a setup to have started', async () => {
    await expect(service.enable(user.id, '123456')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects enabling twice', async () => {
    await enroll();
    await expect(service.beginSetup(user.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('verifyForLogin accepts a current TOTP code', async () => {
    const { secret } = await enroll();
    expect(await service.verifyForLogin(user, generateTotp(secret))).toBe(true);
    expect(await service.verifyForLogin(user, '000000')).toBe(false);
  });

  it('verifyForLogin consumes a backup code exactly once', async () => {
    const { backupCodes } = await enroll();
    const code = backupCodes[0];

    expect(await service.verifyForLogin(user, code)).toBe(true);
    expect(user.mfaBackupCodes).toHaveLength(9);
    // Same code cannot be reused.
    expect(await service.verifyForLogin(user, code)).toBe(false);
  });

  it('disable requires a valid code, then clears MFA state', async () => {
    const { secret } = await enroll();

    await expect(service.disable(user.id, '000000')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    await service.disable(user.id, generateTotp(secret));
    expect(user.mfaEnabled).toBe(false);
    expect(user.mfaSecret).toBeNull();
    expect(user.mfaBackupCodes).toBeNull();
  });
});
