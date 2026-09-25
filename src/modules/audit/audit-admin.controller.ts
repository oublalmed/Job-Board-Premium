import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { StaffMfaGuard } from '../../common/guards/staff-mfa.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { AuditService } from './audit.service.js';
import { AuditLogQueryDto } from './dto/audit-log-query.dto.js';
import {
  AuditLogItemDto,
  AuditLogPageDto,
} from './dto/audit-log-response.dto.js';

// EF-ADM-04 — consulter les journaux d'audit. The audit trail is a
// security/CNDP-sensitive record, so unlike content moderation
// (school-verification, analytics) it is ADMIN-only and never MODERATOR.
// Read-only by construction: entries are append-only and this controller
// exposes no write path.
@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, StaffMfaGuard)
@Roles(Role.ADMIN)
export class AuditAdminController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiResponse({ status: 200, type: AuditLogPageDto })
  async search(@Query() query: AuditLogQueryDto): Promise<AuditLogPageDto> {
    const result = await this.auditService.search(query);
    return {
      items: result.items.map((entry) => AuditLogItemDto.fromEntity(entry)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      pageCount: result.pageCount,
    };
  }
}
