import { Body, Controller, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { TrialCodeAdminService } from './trial-code-admin.service.js';
import { CreateTrialCodeDto } from './dto/create-trial-code.dto.js';

// A financial-policy decision (who gets a free trial, how generous), not
// content moderation — Role.ADMIN only, deliberately excluding MODERATOR
// (CDC §3's role split).
@Controller('admin/trial-codes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class TrialCodeAdminController {
  constructor(private readonly trialCodeAdminService: TrialCodeAdminService) {}

  @Post()
  async create(@Body() dto: CreateTrialCodeDto) {
    return this.trialCodeAdminService.create(dto);
  }

  @Patch(':id/revoke')
  async revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.trialCodeAdminService.revoke(id);
  }
}
