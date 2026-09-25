import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { AssessmentService } from './assessment.service.js';
import { AssessmentHistoryService } from './assessment-history.service.js';
import { RemediationService } from './remediation.service.js';
import { RemediationProgressService } from './remediation-progress.service.js';
import { WebhookService } from './webhook.service.js';
import { StartAssessmentDto } from './dto/start-assessment.dto.js';
import { ResumeAssessmentDto } from './dto/resume-assessment.dto.js';
import { StartAssessmentResponseDto } from './dto/start-assessment-response.dto.js';
import { RemediationFeedbackDto } from './dto/remediation-feedback.dto.js';
import { UpdateRemediationProgressDto } from './dto/update-remediation-progress.dto.js';
import { RecordProctoringEventsDto } from './dto/record-proctoring-events.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';

@Controller('assessments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssessmentController {
  constructor(
    private readonly assessmentService: AssessmentService,
    private readonly assessmentHistoryService: AssessmentHistoryService,
    private readonly remediationService: RemediationService,
    private readonly remediationProgressService: RemediationProgressService,
    private readonly webhookService: WebhookService,
  ) {}

  @Get('mine')
  @Roles(Role.CANDIDATE)
  async getMyHistory(@CurrentUser() user: JwtPayload) {
    return this.assessmentHistoryService.getHistory(user.sub);
  }

  @Post('start')
  @Roles(Role.CANDIDATE)
  @ApiResponse({ status: 201, type: StartAssessmentResponseDto })
  async startAssessment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StartAssessmentDto,
    @Ip() ip: string,
    @Headers('x-device-fingerprint') deviceFingerprint?: string,
  ) {
    // §5.3 anti-cheat: IP + an opaque client device fingerprint feed the
    // multi-account detection; both are optional and never trusted for auth.
    return this.assessmentService.startAssessment(user.sub, dto.testId, {
      ipAddress: ip,
      deviceFingerprint,
    });
  }

  @Post('resume')
  @Roles(Role.CANDIDATE)
  @ApiResponse({ status: 201, type: StartAssessmentResponseDto })
  async resumeAssessment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ResumeAssessmentDto,
  ) {
    return this.assessmentService.resumeAssessment(
      user.sub,
      dto.assessmentId,
      dto.resumeToken,
    );
  }

  @Post(':id/incident')
  @Roles(Role.CANDIDATE)
  async reportIncident(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) assessmentId: string,
  ) {
    return this.assessmentService.reportIncident(user.sub, assessmentId);
  }

  // EF-EVAL-02 / §5.3 — the secure-exam client reports its cumulative
  // tab-switch / window-blur counts for the in-progress attempt. Owner-scoped
  // by the JWT subject; 200 with the updated flag so the client can surface it.
  @Post(':id/proctoring-events')
  @Roles(Role.CANDIDATE)
  @HttpCode(HttpStatus.OK)
  async recordProctoringEvents(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Body() dto: RecordProctoringEventsDto,
  ) {
    const saved = await this.assessmentService.recordProctoringEvents(
      user.sub,
      assessmentId,
      { tabSwitches: dto.tabSwitches, windowBlurs: dto.windowBlurs },
    );
    return {
      tabSwitchCount: saved.tabSwitchCount,
      windowBlurCount: saved.windowBlurCount,
      proctoringFlagged: saved.proctoringFlagged,
    };
  }

  // Local/dev only — complete an in-progress attempt without a real scoring
  // vendor, so the full flow (score, feedback, CVthèque indexation) is
  // exercisable on a developer's machine. Hard-refused in production, where a
  // genuine provider webhook is the only path to a score.
  @Post(':id/complete-dev')
  @Roles(Role.CANDIDATE)
  async completeForDev(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) assessmentId: string,
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Not available in production');
    }
    return this.webhookService.simulateCompletion(user.sub, assessmentId);
  }

  @Get(':id/feedback')
  @Roles(Role.CANDIDATE)
  @ApiResponse({ status: 200, type: RemediationFeedbackDto })
  async getFeedback(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) assessmentId: string,
  ) {
    return this.remediationService.getFeedback(user.sub, assessmentId);
  }

  // EF-CAND-09 — mark a remediation resource complete / incomplete for the
  // current candidate. Idempotent; owner-scoped by the JWT subject. 204 (no
  // body): the client already knows the new state it requested.
  @Put('remediation/progress')
  @Roles(Role.CANDIDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateRemediationProgress(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateRemediationProgressDto,
  ): Promise<void> {
    await this.remediationProgressService.setCompleted(
      user.sub,
      dto.url,
      dto.completed,
    );
  }
}
