import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { CompanyService } from './company.service.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

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
}
