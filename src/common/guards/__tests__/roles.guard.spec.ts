import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../roles.guard.js';
import { Role } from '../../enums/role.enum.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const createMockContext = (roles: Role[]): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { sub: 'user-id', email: 'test@test.com', roles },
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  it('should allow access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext([Role.CANDIDATE]);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has the required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const context = createMockContext([Role.ADMIN]);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has one of multiple required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN, Role.MODERATOR]);
    const context = createMockContext([Role.MODERATOR]);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access when user lacks the required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const context = createMockContext([Role.CANDIDATE]);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should deny access when user has no roles', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const context = createMockContext([]);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should support cumulative roles (user with multiple roles)', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.RECRUITER]);
    const context = createMockContext([
      Role.CANDIDATE,
      Role.RECRUITER,
      Role.COMPANY_ADMIN,
    ]);
    expect(guard.canActivate(context)).toBe(true);
  });
});
