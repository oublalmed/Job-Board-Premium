import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StaffMfaGuard } from '../staff-mfa.guard.js';
import { Role } from '../../enums/role.enum.js';
import { JwtPayload } from '../../interfaces/request-with-user.interface.js';

function contextFor(user: Partial<JwtPayload> | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guardWith(enforced: boolean): StaffMfaGuard {
  const config = {
    get: (_key: string, def?: unknown) => (enforced ? true : def),
  } as unknown as ConfigService;
  return new StaffMfaGuard(config);
}

describe('StaffMfaGuard', () => {
  describe('enforcement disabled (default)', () => {
    const guard = guardWith(false);

    it('passes staff without MFA through', () => {
      expect(
        guard.canActivate(contextFor({ roles: [Role.ADMIN], mfa: false })),
      ).toBe(true);
    });
  });

  describe('enforcement enabled', () => {
    const guard = guardWith(true);

    it('allows non-staff regardless of MFA', () => {
      expect(
        guard.canActivate(contextFor({ roles: [Role.CANDIDATE], mfa: false })),
      ).toBe(true);
    });

    it('allows staff with an MFA-authenticated session', () => {
      expect(
        guard.canActivate(contextFor({ roles: [Role.ADMIN], mfa: true })),
      ).toBe(true);
    });

    it('blocks staff without MFA', () => {
      expect(() =>
        guard.canActivate(contextFor({ roles: [Role.MODERATOR], mfa: false })),
      ).toThrow(ForbiddenException);
    });

    it('blocks staff when the mfa claim is absent', () => {
      expect(() =>
        guard.canActivate(contextFor({ roles: [Role.ADMIN] })),
      ).toThrow(ForbiddenException);
    });
  });
});
