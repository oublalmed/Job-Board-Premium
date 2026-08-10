import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { AnalyticsService } from './analytics.service.js';
import { FunnelDto } from './dto/funnel.dto.js';

// EF-ADM-05 (Lot 8) — the internal amorçage KPI dashboard. Same admin/
// moderator split used by school-verification moderation.
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MODERATOR)
export class AnalyticsAdminController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('funnel')
  @ApiResponse({ status: 200, type: FunnelDto })
  funnel(@Query('days') days?: string): Promise<FunnelDto> {
    const parsed = days !== undefined ? Number(days) : undefined;
    return this.service.funnel(
      parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined,
    );
  }
}
