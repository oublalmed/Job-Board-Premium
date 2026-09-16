import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity.js';
import { Message } from './entities/message.entity.js';
import { MessageReport } from './entities/message-report.entity.js';
import { ConversationService } from './conversation.service.js';
import { ConversationController } from './conversation.controller.js';
import { MessageReportAdminController } from './message-report-admin.controller.js';
import { CandidatesModule } from '../candidates/candidates.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, MessageReport]),
    CandidatesModule,
    CompaniesModule,
    NotificationsModule,
  ],
  controllers: [ConversationController, MessageReportAdminController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class MessagingModule {}
