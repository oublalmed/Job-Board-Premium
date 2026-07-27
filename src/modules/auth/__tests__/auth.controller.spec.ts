import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller.js';
import { AuthService } from '../auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Partial<AuthService>>;

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
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should register a user', async () => {
    const result = await controller.register({
      email: 'test@example.com',
      password: 'StrongP@ss1',
    });
    expect(result.user.email).toBe('test@example.com');
    expect(authService.register).toHaveBeenCalled();
  });

  it('should login a user', async () => {
    const result = await controller.login({
      email: 'test@example.com',
      password: 'StrongP@ss1',
    });
    expect(result.accessToken).toBeDefined();
    expect(authService.login).toHaveBeenCalled();
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
