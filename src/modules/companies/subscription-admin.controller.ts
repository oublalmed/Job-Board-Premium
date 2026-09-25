import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { StaffMfaGuard } from '../../common/guards/staff-mfa.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { SubscriptionAdminService } from './subscription-admin.service.js';
import { SubscriptionStatus } from './entities/subscription.entity.js';
import { AssignPlanDto } from './dto/assign-plan.dto.js';

// Admin management of recruiter subscriptions. ADMIN/MODERATOR only, staff MFA
// enforced — same posture as the other admin controllers.
@Controller('admin/subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard, StaffMfaGuard)
@Roles(Role.ADMIN, Role.MODERATOR)
export class SubscriptionAdminController {
  constructor(private readonly service: SubscriptionAdminService) {}

  @Get()
  async list(@Query('status') status?: string) {
    const parsed = Object.values(SubscriptionStatus).includes(
      status as SubscriptionStatus,
    )
      ? (status as SubscriptionStatus)
      : undefined;
    return this.service.list(parsed);
  }

  // Companies (with recruiters) an admin can assign a pack to.
  @Get('companies')
  async companies() {
    return this.service.listAssignableCompanies();
  }

  // Assign / change a company's pack per its contract.
  @Post('assign')
  async assign(@Body() dto: AssignPlanDto) {
    return this.service.assignPlan(dto.companyId, dto.plan, dto.contactQuota);
  }

  @Patch(':id/cancel')
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(id);
  }

  // Place a subscription on hold (typically an unpaid company). Reversible.
  @Patch(':id/suspend')
  async suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.suspend(id);
  }

  // Lift the hold — SUSPENDED -> ACTIVE.
  @Patch(':id/reactivate')
  async reactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reactivate(id);
  }
}
