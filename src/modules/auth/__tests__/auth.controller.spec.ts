import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller.js';
import { AuthService } from '../auth.service.js';
import { MfaService } from '../mfa.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Partial<AuthService>>;
  let mfaService: jest.Mocked<Partial<MfaService>>;

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
    };

    mfaService = {
      beginSetup: jest
        .fn()
        .mockResolvedValue({ secret: 'SECRET', otpauthUri: 'otpauth://x' }),
      enable: jest.fn().mockResolvedValue({ backupCodes: ['a', 'b'] }),
      disable: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: MfaService, useValue: mfaService },
      ],
    }).compile();

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

  it('should return user profile', () => {
    const result = controller.getProfile({
      sub: 'uuid',
      email: 'test@example.com',
      roles: [],
    });
    expect(result.userId).toBe('uuid');
  });
});
