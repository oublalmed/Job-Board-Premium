import { IsEnum } from 'class-validator';
import { MessageReportStatus } from '../entities/message-report.entity.js';

// EF-ADM-01 — a moderator resolves a reported conversation.
export class UpdateReportStatusDto {
  @IsEnum(MessageReportStatus)
  status!: MessageReportStatus;
}
