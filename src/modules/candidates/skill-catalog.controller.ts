import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { SkillCatalogService } from './skill-catalog.service.js';
import { SkillSummaryDto } from './dto/skill-summary.dto.js';

// The Skill referential table existed (used read-only by completeness
// counting) but had no listing endpoint anywhere — a candidate had no way
// to discover which skills exist to attach to their profile. Real gap
// found scoping Front 1, not a pre-planned feature.
@Controller('skills')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CANDIDATE)
export class SkillCatalogController {
  constructor(private readonly skillCatalogService: SkillCatalogService) {}

  @Get()
  @ApiResponse({ status: 200, type: SkillSummaryDto, isArray: true })
  async listSkills() {
    return this.skillCatalogService.listSkills();
  }
}
