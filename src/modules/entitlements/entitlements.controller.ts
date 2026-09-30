import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { EntitlementService } from './entitlement.service.js';

// The caller's own company entitlements — the frontend reads this to gate the
// UI (show/hide features, No-Access states §14) in sync with the backend.
@Controller('entitlements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RECRUITER, Role.COMPANY_ADMIN)
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementService) {}

  @Get()
  async mine(@CurrentUser() user: JwtPayload) {
    return this.entitlements.getEntitlementsForUser(user.sub);
  }
}
