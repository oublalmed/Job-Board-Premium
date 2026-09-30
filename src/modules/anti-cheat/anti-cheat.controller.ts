import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
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
import { AntiCheatService } from './anti-cheat.service.js';
import { SetAntiCheatDto } from './dto/set-anti-cheat.dto.js';

// §2 — recruiter-facing anti-cheat. The whole controller is gated by the
// ANTI_CHEAT feature (FeatureGuard → 403 FEATURE_NOT_AVAILABLE for plans
// without it), so access is enforced at the API, not merely hidden in the UI.
@Controller('anti-cheat')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Roles(Role.RECRUITER, Role.COMPANY_ADMIN)
@RequireFeature(Feature.ANTI_CHEAT)
export class AntiCheatController {
  constructor(
    private readonly antiCheat: AntiCheatService,
    private readonly entitlements: EntitlementService,
  ) {}

  @Get('setting')
  async getSetting(@CurrentUser() user: JwtPayload) {
    const companyId = await this.entitlements.resolveCompanyId(user.sub);
    return this.antiCheat.getSetting(companyId);
  }

  // §2.1 — the recruiter can turn the option on/off (only reachable with the
  // ANTI_CHEAT feature).
  @Patch('setting')
  async setSetting(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetAntiCheatDto,
  ) {
    const companyId = await this.entitlements.resolveCompanyId(user.sub);
    return this.antiCheat.setSetting(companyId, dto.enabled);
  }

  // §2.3 — the anti-cheat indicators for a candidate.
  @Get('candidates/:id')
  async candidate(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) candidateProfileId: string,
  ) {
    const companyId = await this.entitlements.resolveCompanyId(user.sub);
    return this.antiCheat.getCandidateIntegrity(companyId, candidateProfileId);
  }
}
