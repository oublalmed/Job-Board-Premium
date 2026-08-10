import {
  Controller,
  Post,
  Get,
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
import { ConversationService } from './conversation.service.js';
import { OpenConversationDto } from './dto/open-conversation.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';

@Controller('conversations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  // Initiation reserved to recruiters — a candidate cannot open a thread on
  // themselves (see US-RECR-05 / CDC §4.5).
  @Post()
  @Roles(Role.RECRUITER, Role.COMPANY_ADMIN)
  async openConversation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: OpenConversationDto,
  ) {
    return this.conversationService.openConversation(
      user.sub,
      dto.candidateProfileId,
      dto.message,
    );
  }

  @Get()
  @Roles(Role.RECRUITER, Role.COMPANY_ADMIN, Role.CANDIDATE)
  async listConversations(@CurrentUser() user: JwtPayload) {
    return this.conversationService.listConversations(user.sub);
  }

  @Get(':id/messages')
  @Roles(Role.RECRUITER, Role.COMPANY_ADMIN, Role.CANDIDATE)
  async listMessages(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ) {
    return this.conversationService.listMessages(conversationId, user.sub);
  }

  @Post(':id/messages')
  @Roles(Role.RECRUITER, Role.COMPANY_ADMIN, Role.CANDIDATE)
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.conversationService.sendMessage(
      conversationId,
      user.sub,
      dto.body,
    );
  }
}
