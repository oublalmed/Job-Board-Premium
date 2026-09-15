import { ApiProperty } from '@nestjs/swagger';
import { AuditAction } from '../../../common/enums/audit-action.enum.js';
import { AuditLog } from '../entities/audit-log.entity.js';

export class AuditLogItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: AuditAction })
  action!: AuditAction;

  @ApiProperty({
    nullable: true,
    description: 'User id that performed the action, null for system actions.',
  })
  actorId!: string | null;

  @ApiProperty({ nullable: true })
  entityType!: string | null;

  @ApiProperty({ nullable: true })
  entityId!: string | null;

  @ApiProperty({ nullable: true, type: Object })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ nullable: true })
  ipAddress!: string | null;

  @ApiProperty({ nullable: true })
  userAgent!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  static fromEntity(entry: AuditLog): AuditLogItemDto {
    const dto = new AuditLogItemDto();
    dto.id = entry.id;
    dto.action = entry.action;
    dto.actorId = entry.actorId;
    dto.entityType = entry.entityType;
    dto.entityId = entry.entityId;
    dto.metadata = entry.metadata;
    dto.ipAddress = entry.ipAddress;
    dto.userAgent = entry.userAgent;
    dto.createdAt = entry.createdAt;
    return dto;
  }
}

export class AuditLogPageDto {
  @ApiProperty({ type: [AuditLogItemDto] })
  items!: AuditLogItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  pageCount!: number;
}
