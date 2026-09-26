import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { StaffMfaGuard } from '../../common/guards/staff-mfa.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { ProctoringAdminService } from './proctoring-admin.service.js';

// Admin exam-integrity / anti-cheat overview. ADMIN/MODERATOR only, staff MFA
// enforced — same posture as the other admin controllers.
@Controller('admin/assessment-integrity')
@UseGuards(JwtAuthGuard, RolesGuard, StaffMfaGuard)
@Roles(Role.ADMIN, Role.MODERATOR)
export class ProctoringAdminController {
  constructor(private readonly service: ProctoringAdminService) {}

  @Get()
  async list(@Query('scope') scope?: string) {
    return this.service.list(scope !== 'all');
  }
}
