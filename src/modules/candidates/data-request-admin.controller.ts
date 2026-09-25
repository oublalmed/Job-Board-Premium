import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { StaffMfaGuard } from '../../common/guards/staff-mfa.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { DataRequestService } from './data-request.service.js';
import { DataRequestQueryDto } from './dto/data-request-query.dto.js';
import { UpdateDataRequestDto } from './dto/update-data-request.dto.js';
import { toDataRequestResponse } from './dto/data-request-response.dto.js';

// EF-ADM-03 — the CNDP/RGPD request processing queue. ADMIN-only and behind
// StaffMfaGuard because completing an erasure request is destructive; every
// transition is written to the audit trail by the service.
@Controller('admin/data-requests')
@UseGuards(JwtAuthGuard, RolesGuard, StaffMfaGuard)
@Roles(Role.ADMIN)
export class DataRequestAdminController {
  constructor(private readonly dataRequestService: DataRequestService) {}

  @Get()
  async list(@Query() query: DataRequestQueryDto) {
    const result = await this.dataRequestService.search(query);
    return {
      items: result.items.map(toDataRequestResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
      pageCount: result.pageCount,
    };
  }

  @Patch(':id')
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDataRequestDto,
  ) {
    const updated = await this.dataRequestService.updateStatus(
      id,
      user.sub,
      dto.status,
      dto.resolutionNote,
    );
    return toDataRequestResponse(updated);
  }
}
