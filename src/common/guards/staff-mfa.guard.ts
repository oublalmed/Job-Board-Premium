import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '../enums/role.enum.js';
import { RequestWithUser } from '../interfaces/request-with-user.interface.js';

// Staff roles that must present a second factor once enforcement is on.
const STAFF_ROLES: readonly Role[] = [Role.ADMIN, Role.MODERATOR];

/**
 * ENF-06 — requires that staff (admin/moderator) sessions were
 * MFA-authenticated before reaching a protected handler.
 *
 * Gated by `auth.mfaEnforceStaff` (env MFA_ENFORCE_STAFF): default OFF so an
 * organisation can enroll its staff in MFA before flipping enforcement on —
 * enabling it before enrollment would lock every admin out. When off, the
 * guard is a pass-through and existing sessions are unaffected.
 *
 * Meant to be layered AFTER JwtAuthGuard (so `request.user` is populated);
 * non-staff users always pass.
 */
@Injectable()
export class StaffMfaGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const enforced = this.configService.get<boolean>(
      'auth.mfaEnforceStaff',
      false,
    );
    if (!enforced) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    const isStaff = user?.roles?.some((role) => STAFF_ROLES.includes(role));
    if (!isStaff) {
      return true;
    }

    if (user.mfa !== true) {
      throw new ForbiddenException(
        'Multi-factor authentication is required for staff accounts',
      );
    }
    return true;
  }
}
