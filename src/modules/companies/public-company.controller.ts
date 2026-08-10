import { Controller, Get } from '@nestjs/common';
import { CompanyService } from './company.service.js';

// Unauthenticated companies routes — intentionally NOT behind JwtAuthGuard,
// unlike CompanyController. Kept in a separate controller so the guard stays a
// class-level default there and public surface is opt-in and explicit here.
@Controller('companies')
export class PublicCompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get('partners')
  async listPartners() {
    return this.companyService.listPartners();
  }
}
