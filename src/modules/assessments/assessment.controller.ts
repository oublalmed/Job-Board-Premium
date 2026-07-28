import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AssessmentService } from './assessment.service.js';
import { StartAssessmentDto } from './dto/start-assessment.dto.js';
import { ResumeAssessmentDto } from './dto/resume-assessment.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';

@Controller('assessments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Post('start')
  @Roles(Role.CANDIDATE)
  async startAssessment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StartAssessmentDto,
  ) {
    return this.assessmentService.startAssessment(user.sub, dto.testId);
  }

  @Post('resume')
  @Roles(Role.CANDIDATE)
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
}
