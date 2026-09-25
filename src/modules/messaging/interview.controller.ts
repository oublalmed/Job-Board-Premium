import {
  Controller,
  Post,
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
import { InterviewService } from './interview.service.js';
import { ProposeInterviewDto } from './dto/propose-interview.dto.js';
import { RespondInterviewDto } from './dto/respond-interview.dto.js';

// EF-MSG-04 — interview scheduling within a conversation. Every route is
// scoped to a participant of the thread (same rule as messaging); a
// non-participant gets the conversation's 404.
@Controller('conversations/:id/interviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RECRUITER, Role.COMPANY_ADMIN, Role.CANDIDATE)
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  @Post()
  async propose(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: ProposeInterviewDto,
  ) {
    return this.interviewService.propose(conversationId, user.sub, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ) {
    return this.interviewService.list(conversationId, user.sub);
  }

  @Patch(':interviewId')
  async respond(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Param('interviewId', ParseUUIDPipe) interviewId: string,
    @Body() dto: RespondInterviewDto,
  ) {
    return this.interviewService.respond(
      conversationId,
      interviewId,
      user.sub,
      dto.status,
    );
  }
}
