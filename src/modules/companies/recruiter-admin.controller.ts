import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { StaffMfaGuard } from '../../common/guards/staff-mfa.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { RecruiterAdminService } from './recruiter-admin.service.js';
import { CreateRecruiterDto } from './dto/create-recruiter.dto.js';

// Admin provisioning of recruiter accounts. ADMIN/MODERATOR only, staff MFA
// enforced — same posture as the other admin controllers.
@Controller('admin/recruiters')
@UseGuards(JwtAuthGuard, RolesGuard, StaffMfaGuard)
@Roles(Role.ADMIN, Role.MODERATOR)
export class RecruiterAdminController {
  constructor(private readonly service: RecruiterAdminService) {}

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRecruiterDto,
  ) {
    return this.service.createRecruiter(user.sub, dto);
  }
}
