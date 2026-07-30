import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity.js';
import { Message } from './entities/message.entity.js';
import { ConversationService } from './conversation.service.js';
import { ConversationController } from './conversation.controller.js';
import { CandidatesModule } from '../candidates/candidates.module.js';
import { CompaniesModule } from '../companies/companies.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message]),
    CandidatesModule,
    CompaniesModule,
  ],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class MessagingModule {}
