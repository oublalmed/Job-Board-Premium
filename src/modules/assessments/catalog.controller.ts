import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { CatalogService } from './catalog.service.js';
import { ListTestsQueryDto } from './dto/list-tests-query.dto.js';
import { SpecialtySummaryDto } from './dto/specialty-summary.dto.js';
import { TestSummaryDto } from './dto/test-summary.dto.js';

// Referential data (specialties, tests) — existed only as entities with no
// listing endpoint (POST /assessments/start requires a raw testId, but
// nothing exposed which ones exist). A real gap found while scoping Front
// 1's "sélection de spécialité" (EF-EVAL-01), not a pre-planned feature.
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CANDIDATE)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('specialties')
  @ApiResponse({ status: 200, type: SpecialtySummaryDto, isArray: true })
  async listSpecialties() {
    return this.catalogService.listSpecialties();
  }

  @Get('tests')
  @ApiResponse({ status: 200, type: TestSummaryDto, isArray: true })
  async listTests(@Query() query: ListTestsQueryDto) {
    return this.catalogService.listTests(query.specialtyId);
  }

  @Get('assessments/composition')
  async getComposition() {
    return this.catalogService.getComposition();
  }
}
