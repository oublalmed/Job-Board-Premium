import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { FeatureGuard } from '../entitlements/feature.guard.js';
import { RequireFeature } from '../entitlements/require-feature.decorator.js';
import { Feature } from '../entitlements/feature.enum.js';
import { EntitlementService } from '../entitlements/entitlement.service.js';
import { RecruiterAnalyticsService } from './recruiter-analytics.service.js';

// §4 — recruiter analytics dashboard. Gated by BASIC_ANALYTICS (every pack has
// it; the guard still enforces it at the API). Company-scoped via the
// entitlement service, so a recruiter only ever sees their own company's data.
@Controller('recruiter/analytics')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Roles(Role.RECRUITER, Role.COMPANY_ADMIN)
@RequireFeature(Feature.BASIC_ANALYTICS)
export class AnalyticsRecruiterController {
  constructor(
    private readonly service: RecruiterAnalyticsService,
    private readonly entitlements: EntitlementService,
  ) {}

  @Get('overview')
  async overview(
    @CurrentUser() user: JwtPayload,
    @Query('days') days?: string,
  ) {
    const companyId = await this.entitlements.resolveCompanyId(user.sub);
    const parsed = days !== undefined ? Number(days) : undefined;
    return this.service.overview(
      companyId,
      parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined,
    );
  }
}
