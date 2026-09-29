import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { JobsService } from './jobs.service.js';
import { ApplicationsService } from './applications.service.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { UpdateJobDto } from './dto/update-job.dto.js';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto.js';

// §3.1 — recruiter job management. Gated by the JOBS feature (FeatureGuard →
// 403 FEATURE_NOT_AVAILABLE for Starter), enforced at the API.
@Controller('recruiter/jobs')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Roles(Role.RECRUITER, Role.COMPANY_ADMIN)
@RequireFeature(Feature.JOBS)
export class JobsRecruiterController {
  constructor(
    private readonly jobs: JobsService,
    private readonly applications: ApplicationsService,
    private readonly entitlements: EntitlementService,
  ) {}

  private company(user: JwtPayload) {
    return this.entitlements.resolveCompanyId(user.sub);
  }

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateJobDto) {
    return this.jobs.create(await this.company(user), user.sub, dto);
  }

  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    return this.jobs.listForCompany(await this.company(user));
  }

  // Update an application's status (§3.4). Declared before ':id' — different
  // segment count, but kept explicit.
  @Patch('applications/:id/status')
  async updateApplicationStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.applications.updateStatus(
      id,
      await this.company(user),
      dto.status,
    );
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobs.getForCompany(await this.company(user), id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobs.update(await this.company(user), id, dto);
  }

  @Post(':id/publish')
  async publish(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobs.publish(await this.company(user), id);
  }

  @Post(':id/close')
  async close(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobs.close(await this.company(user), id);
  }

  @Get(':id/applications')
  async applicationsFor(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applications.listForOffer(id, await this.company(user));
  }
}
