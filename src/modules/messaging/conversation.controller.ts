import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { ConversationService } from './conversation.service.js';
import { OpenConversationDto } from './dto/open-conversation.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { SendAttachmentDto } from './dto/send-attachment.dto.js';
import { ReportConversationDto } from './dto/report-conversation.dto.js';

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

  // EF-MSG-03 — attach ONE document (PDF/DOCX ≤5MB, antivirus-gated) to a new
  // message. Scoped to a participant of the conversation (same check as
  // sending). `body` is an optional caption.
  @Post(':id/messages/attachment')
  @Roles(Role.RECRUITER, Role.COMPANY_ADMIN, Role.CANDIDATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        body: { type: 'string' },
      },
    },
  })
  async sendAttachment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: SendAttachmentDto,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }
    return this.conversationService.sendAttachment(
      conversationId,
      user.sub,
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      dto.body,
    );
  }

  // EF-MSG-03 — a signed URL for an attachment, authorized to the two
  // conversation participants only (403 otherwise).
  @Get(':id/messages/:messageId/attachment')
  @Roles(Role.RECRUITER, Role.COMPANY_ADMIN, Role.CANDIDATE)
  async getAttachment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.conversationService.getAttachmentSignedUrl(
      conversationId,
      messageId,
      user.sub,
    );
  }

  // EF-MSG-05 — flag a conversation for abuse.
  @Post(':id/report')
  @Roles(Role.RECRUITER, Role.COMPANY_ADMIN, Role.CANDIDATE)
  async reportConversation(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: ReportConversationDto,
  ) {
    return this.conversationService.reportConversation(
      conversationId,
      user.sub,
      dto.reason,
    );
  }
}
