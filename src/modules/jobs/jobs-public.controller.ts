import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { JobsService } from './jobs.service.js';
import { ApplicationsService } from './applications.service.js';
import { JobSearchDto } from './dto/job-search.dto.js';
import { ApplyDto } from './dto/apply.dto.js';

// §3.2 — the candidate Jobs tab: browse/search published offers, view detail,
// apply, and track applications. Not feature-gated (candidates can always
// apply); the recruiter side is what the JOBS feature gates.
@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CANDIDATE)
export class JobsPublicController {
  constructor(
    private readonly jobs: JobsService,
    private readonly applications: ApplicationsService,
  ) {}

  @Get()
  async search(@Query() dto: JobSearchDto) {
    return this.jobs.searchPublished(dto);
  }

  @Get('mine/applications')
  async mine(@CurrentUser() user: JwtPayload) {
    return this.applications.listMine(user.sub);
  }

  @Get(':id')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.getPublished(id);
  }

  @Post(':id/apply')
  async apply(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyDto,
  ) {
    return this.applications.apply(user.sub, id, dto);
  }
}
