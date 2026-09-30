import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { StaffMfaGuard } from '../../common/guards/staff-mfa.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';
import { EntitlementService } from './entitlement.service.js';
import { Feature } from './feature.enum.js';
import { SetFeatureOverrideDto } from './dto/set-feature-override.dto.js';

// §12 — admin view/management of a company's pack, features, limits and
// overrides. ADMIN/MODERATOR + staff MFA, same posture as the other admin
// controllers.
@Controller('admin/companies/:companyId/entitlements')
@UseGuards(JwtAuthGuard, RolesGuard, StaffMfaGuard)
@Roles(Role.ADMIN, Role.MODERATOR)
export class EntitlementsAdminController {
  constructor(
    private readonly entitlements: EntitlementService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async get(@Param('companyId', ParseUUIDPipe) companyId: string) {
    const [entitlements, overrides, users] = await Promise.all([
      this.entitlements.getEntitlementsForCompany(companyId),
      this.entitlements.listOverrides(companyId),
      this.entitlements.countUsers(companyId),
    ]);
    return { ...entitlements, overrides, usage: { users } };
  }

  // Force a feature on/off for this company (source = ADMIN_OVERRIDE).
  @Put('features/:feature')
  async setOverride(
    @CurrentUser() user: JwtPayload,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('feature') feature: string,
    @Body() dto: SetFeatureOverrideDto,
  ) {
    const f = this.parseFeature(feature);
    const saved = await this.entitlements.setOverride(
      companyId,
      f,
      dto.enabled,
      user.sub,
      dto.note,
    );
    await this.auditService.log({
      actorId: user.sub,
      action: AuditAction.FEATURE_OVERRIDE_CHANGED,
      entityType: 'feature_override',
      entityId: saved.id,
      metadata: { companyId, feature: f, enabled: dto.enabled },
    });
    return saved;
  }

  // Remove the override (feature reverts to the plan matrix).
  @Delete('features/:feature')
  async clearOverride(
    @CurrentUser() user: JwtPayload,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('feature') feature: string,
  ) {
    const f = this.parseFeature(feature);
    await this.entitlements.clearOverride(companyId, f);
    await this.auditService.log({
      actorId: user.sub,
      action: AuditAction.FEATURE_OVERRIDE_CHANGED,
      entityType: 'feature_override',
      entityId: `${companyId}:${f}`,
      metadata: { companyId, feature: f, cleared: true },
    });
    return { cleared: true };
  }

  private parseFeature(value: string): Feature {
    if (!Object.values(Feature).includes(value as Feature)) {
      throw new BadRequestException(`Unknown feature: ${value}`);
    }
    return value as Feature;
  }
}
