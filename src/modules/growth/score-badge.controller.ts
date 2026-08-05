import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { ScoreBadgeService } from './score-badge.service.js';
import { EnableScoreBadgeDto } from './dto/enable-score-badge.dto.js';
import { ScoreBadgeStatusDto } from './dto/score-badge-status.dto.js';

// EF-GROW-01 (Lot 7) — candidate-side control of their shareable score badge.
@Controller('candidates/score-badge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CANDIDATE)
export class ScoreBadgeController {
  constructor(private readonly service: ScoreBadgeService) {}

  @Get()
  @ApiResponse({ status: 200, type: ScoreBadgeStatusDto })
  getMine(@CurrentUser() user: JwtPayload) {
    return this.service.getStatus(user.sub);
  }

  @Post()
  @ApiResponse({ status: 201, type: ScoreBadgeStatusDto })
  enable(@CurrentUser() user: JwtPayload, @Body() dto: EnableScoreBadgeDto) {
    return this.service.enable(user.sub, dto.displayName);
  }

  @Delete()
  @ApiResponse({ status: 200, type: ScoreBadgeStatusDto })
  disable(@CurrentUser() user: JwtPayload) {
    return this.service.disable(user.sub);
  }
}
