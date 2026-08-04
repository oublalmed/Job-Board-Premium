import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { SchoolVerificationService } from './school-verification.service.js';
import { ReviewDecisionDto } from './dto/review-decision.dto.js';

// A content-review action (does this document actually show what it
// claims), not a financial-policy one — Role.ADMIN and Role.MODERATOR
// both allowed, same split already used for job-offer moderation
// (job-offer.controller.ts) and deliberately different from
// trial-code-admin.controller.ts, which excludes MODERATOR.
@Controller('admin/school-verifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MODERATOR)
export class SchoolVerificationAdminController {
  constructor(
    private readonly schoolVerificationService: SchoolVerificationService,
  ) {}

  @Get()
  async listPending() {
    const items = await this.schoolVerificationService.listPending();
    return items.map((v) => ({
      id: v.id,
      candidateName:
        [v.candidateProfile.firstName, v.candidateProfile.lastName]
          .filter(Boolean)
          .join(' ') || null,
      matchedSchool: v.matchedSchool,
      confidence: v.confidence,
      createdAt: v.createdAt,
    }));
  }

  @Get(':id')
  async getDetail(@Param('id', ParseUUIDPipe) id: string) {
    const { verification, documentUrl } =
      await this.schoolVerificationService.getDetailForAdmin(id);
    return {
      id: verification.id,
      status: verification.status,
      candidateName:
        [
          verification.candidateProfile.firstName,
          verification.candidateProfile.lastName,
        ]
          .filter(Boolean)
          .join(' ') || null,
      ocrExtractedText: verification.ocrExtractedText,
      matchedSchool: verification.matchedSchool,
      confidence: verification.confidence,
      documentUrl,
      documentName: verification.document.originalName,
      createdAt: verification.createdAt,
      reviewedAt: verification.reviewedAt,
      reviewNote: verification.reviewNote,
    };
  }

  @Patch(':id/verify')
  async verify(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    const verification = await this.schoolVerificationService.approve(
      id,
      user.sub,
      dto.note,
    );
    return { id: verification.id, status: verification.status };
  }

  @Patch(':id/reject')
  async reject(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    const verification = await this.schoolVerificationService.reject(
      id,
      user.sub,
      dto.note,
    );
    return { id: verification.id, status: verification.status };
  }
}
