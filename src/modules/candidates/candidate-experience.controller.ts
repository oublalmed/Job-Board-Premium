import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { CandidateExperienceService } from './candidate-experience.service.js';
import { CreateExperienceDto } from './dto/create-experience.dto.js';
import { UpdateExperienceDto } from './dto/update-experience.dto.js';

// Did not exist at all before Front 1 (EF-CAND-02) — the Experience
// entity was written-to nowhere in the API, only read for completeness
// counting. See PROGRESS.md, Front 1 recon.
@Controller('candidates/experiences')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CANDIDATE)
export class CandidateExperienceController {
  constructor(private readonly experienceService: CandidateExperienceService) {}

  @Get()
  async listMine(@CurrentUser() user: JwtPayload) {
    return this.experienceService.listMine(user.sub);
  }

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateExperienceDto,
  ) {
    return this.experienceService.create(user.sub, dto);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExperienceDto,
  ) {
    return this.experienceService.update(user.sub, id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.experienceService.remove(user.sub, id);
    return { message: 'Experience deleted' };
  }
}
