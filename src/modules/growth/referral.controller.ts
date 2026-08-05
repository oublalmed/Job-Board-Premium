import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { ReferralService } from './referral.service.js';
import { ReferralDto } from './dto/referral.dto.js';

// EF-GROW-02 (Lot 7) — candidate's referral link + conversion stats.
@Controller('candidates/referral')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CANDIDATE)
export class ReferralController {
  constructor(private readonly service: ReferralService) {}

  @Get()
  @ApiResponse({ status: 200, type: ReferralDto })
  getMine(@CurrentUser() user: JwtPayload) {
    return this.service.getOrCreateForUser(user.sub);
  }
}
