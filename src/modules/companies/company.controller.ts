import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { CompanyService } from './company.service.js';
import { SubscriptionGuardService } from './subscription-guard.service.js';
import { ContactQuotaService } from './contact-quota.service.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { ContactQuotaStatusDto } from './dto/contact-quota-status.dto.js';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly subscriptionGuard: SubscriptionGuardService,
    private readonly contactQuotaService: ContactQuotaService,
  ) {}

  @Post()
  async createCompany(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCompanyDto,
  ) {
    return this.companyService.createCompany(user.sub, dto);
  }

  @Get('me')
  async getMyCompany(@CurrentUser() user: JwtPayload) {
    return this.companyService.getMyCompany(user.sub);
  }

  // EF-RECR-05 — the recruiter's current contact-quota snapshot, so the UI
  // can surface "X contacts restants" before the limit blocks an outreach.
  @Get('contact-quota')
  @ApiResponse({ status: 200, type: ContactQuotaStatusDto })
  async getContactQuota(
    @CurrentUser() user: JwtPayload,
  ): Promise<ContactQuotaStatusDto> {
    const companyId = await this.subscriptionGuard.resolveCompanyId(user.sub);
    return this.contactQuotaService.getQuotaStatus(companyId);
  }
}
