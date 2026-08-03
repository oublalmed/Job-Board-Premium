import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { CandidateSkillService } from './candidate-skill.service.js';
import { AddProfileSkillDto } from './dto/add-profile-skill.dto.js';
import { ProfileSkillSummaryDto } from './dto/profile-skill-summary.dto.js';

// Did not exist at all before Front 1 — ProfileSkill was read-only
// (completeness counting), attaching a skill to a profile had no
// endpoint. See PROGRESS.md, Front 1 recon. Distinct from GET /skills
// (skill-catalog.controller.ts), which lists the referential, not what a
// candidate has attached to their own profile.
@Controller('candidates/skills')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CANDIDATE)
export class CandidateSkillController {
  constructor(private readonly skillService: CandidateSkillService) {}

  @Get()
  @ApiResponse({ status: 200, type: ProfileSkillSummaryDto, isArray: true })
  async listMine(@CurrentUser() user: JwtPayload) {
    return this.skillService.listMine(user.sub);
  }

  @Post()
  @ApiResponse({ status: 201, type: ProfileSkillSummaryDto })
  async add(@CurrentUser() user: JwtPayload, @Body() dto: AddProfileSkillDto) {
    return this.skillService.add(user.sub, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.skillService.remove(user.sub, id);
    return { message: 'Skill removed' };
  }
}
