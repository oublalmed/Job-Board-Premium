import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthController } from '../auth.controller.js';
import { AuthService } from '../auth.service.js';
import { MfaService } from '../mfa.service.js';
import { UsersService } from '../../users/users.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Partial<AuthService>>;
  let mfaService: jest.Mocked<Partial<MfaService>>;
  let usersService: jest.Mocked<Partial<UsersService>>;

  beforeEach(async () => {
    authService = {
      register: jest.fn().mockResolvedValue({
        user: { id: 'uuid', email: 'test@example.com' },
        message: 'Registration successful. Please verify your email.',
      }),
      login: jest.fn().mockResolvedValue({
        accessToken: 'jwt-access',
        refreshToken: 'refresh-opaque',
      }),
      verifyEmail: jest.fn().mockResolvedValue({
        message: 'Email verified successfully',
      }),
      refreshTokens: jest.fn().mockResolvedValue({
        accessToken: 'new-jwt-access',
        refreshToken: 'new-refresh-opaque',
      }),
      verifyMfaChallenge: jest.fn().mockResolvedValue({
        accessToken: 'mfa-access',
        refreshToken: 'mfa-refresh',
      }),
      requestPasswordReset: jest
        .fn()
        .mockResolvedValue({ message: 'If an account exists…' }),
      resetPassword: jest
        .fn()
        .mockResolvedValue({ message: 'Password reset successfully' }),
      changePassword: jest
        .fn()
        .mockResolvedValue({ message: 'Password changed successfully' }),
    };

    mfaService = {
      beginSetup: jest
        .fn()
        .mockResolvedValue({ secret: 'SECRET', otpauthUri: 'otpauth://x' }),
      enable: jest.fn().mockResolvedValue({ backupCodes: ['a', 'b'] }),
      disable: jest.fn().mockResolvedValue(undefined),
    };

    usersService = {
      findById: jest.fn().mockResolvedValue({ mfaEnabled: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: MfaService, useValue: mfaService },
        { provide: UsersService, useValue: usersService },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should register a user', async () => {
    const result = await controller.register({
      email: 'test@example.com',
      password: 'StrongP@ss1',
      consentAccepted: true,
    });
    expect(result.user.email).toBe('test@example.com');
    expect(authService.register).toHaveBeenCalled();
  });

  it('should login a user', async () => {
    const result = (await controller.login({
      email: 'test@example.com',
      password: 'StrongP@ss1',
    })) as { accessToken?: string };
    expect(result.accessToken).toBeDefined();
    expect(authService.login).toHaveBeenCalled();
  });

  it('should complete an MFA login', async () => {
    const result = await controller.loginMfa({
      mfaToken: 'challenge',
      code: '123456',
    });
    expect(result.accessToken).toBe('mfa-access');
    expect(authService.verifyMfaChallenge).toHaveBeenCalledWith(
      'challenge',
      '123456',
    );
  });

  it('should start MFA setup', async () => {
    const result = await controller.mfaSetup({
      sub: 'uuid',
      email: 'test@example.com',
      roles: [],
    });
    expect(result.otpauthUri).toBeDefined();
    expect(mfaService.beginSetup).toHaveBeenCalledWith('uuid');
  });

  it('should enable MFA', async () => {
    const result = await controller.mfaEnable(
      { sub: 'uuid', email: 'test@example.com', roles: [] },
      { code: '123456' },
    );
    expect(result.backupCodes).toHaveLength(2);
  });

  it('should disable MFA', async () => {
    const result = await controller.mfaDisable(
      { sub: 'uuid', email: 'test@example.com', roles: [] },
      { code: '123456' },
    );
    expect(result.message).toContain('disabled');
    expect(mfaService.disable).toHaveBeenCalledWith('uuid', '123456');
  });

  it('should verify email', async () => {
    const result = await controller.verifyEmail({ token: 'valid-token' });
    expect(result.message).toContain('verified');
  });

  it('should refresh tokens', async () => {
    const result = await controller.refresh({ refreshToken: 'old-token' });
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it('should return user profile with MFA state', async () => {
    const result = await controller.getProfile({
      sub: 'uuid',
      email: 'test@example.com',
      roles: [],
    });
    expect(result.userId).toBe('uuid');
    expect(result.mfaEnabled).toBe(true);
    expect(usersService.findById).toHaveBeenCalledWith('uuid');
  });

  it('should change the password for the authenticated user', async () => {
    const result = await controller.changePassword(
      { sub: 'uuid', email: 'test@example.com', roles: [] },
      { currentPassword: 'OldP@ss123', newPassword: 'NewStr0ng!Pass' },
    );
    expect(result.message).toContain('changed');
    expect(authService.changePassword).toHaveBeenCalledWith(
      'uuid',
      'OldP@ss123',
      'NewStr0ng!Pass',
    );
  });

  it('forwards a forgot-password request', async () => {
    await controller.forgotPassword({ email: 'test@example.com' });
    expect(authService.requestPasswordReset).toHaveBeenCalledWith(
      'test@example.com',
    );
  });

  it('forwards a reset-password request', async () => {
    await controller.resetPassword({
      token: 'tok',
      password: 'NewStr0ng!Pass',
    });
    expect(authService.resetPassword).toHaveBeenCalledWith(
      'tok',
      'NewStr0ng!Pass',
    );
  });
});
