import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { StaffMfaGuard } from '../../common/guards/staff-mfa.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { ProfileModerationService } from './profile-moderation.service.js';
import { ProfileModerationStatus } from './entities/candidate-profile.entity.js';
import { ModerateProfileDto } from './dto/moderate-profile.dto.js';

// EF-ADM-01 — admin moderation of candidate profiles. ADMIN/MODERATOR only,
// staff MFA enforced (same posture as settings and data-request moderation).
@Controller('admin/profiles')
@UseGuards(JwtAuthGuard, RolesGuard, StaffMfaGuard)
@Roles(Role.ADMIN, Role.MODERATOR)
export class ProfileModerationAdminController {
  constructor(private readonly moderation: ProfileModerationService) {}

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedStatus = Object.values(ProfileModerationStatus).includes(
      status as ProfileModerationStatus,
    )
      ? (status as ProfileModerationStatus)
      : undefined;
    return this.moderation.list({
      status: parsedStatus,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Patch(':id/moderation')
  async moderate(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateProfileDto,
  ) {
    return this.moderation.setModeration(id, dto.status, user.sub);
  }
}
