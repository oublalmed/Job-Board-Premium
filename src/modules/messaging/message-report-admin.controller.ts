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
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { ConversationService } from './conversation.service.js';
import { MessageReportStatus } from './entities/message-report.entity.js';
import { UpdateReportStatusDto } from './dto/update-report-status.dto.js';

// EF-ADM-01 / EF-MSG-05 (admin side) — the message-abuse moderation queue.
// Same admin/moderator split as school-verification moderation.
@Controller('admin/message-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MODERATOR)
export class MessageReportAdminController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  async list(@Query('status') status?: MessageReportStatus) {
    const reports = await this.conversationService.listReports(
      status && Object.values(MessageReportStatus).includes(status)
        ? status
        : undefined,
    );
    return reports.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      reporterUserId: r.reporterUserId,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  @Patch(':id')
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.conversationService.updateReportStatus(
      id,
      dto.status,
      user.sub,
    );
  }
}
