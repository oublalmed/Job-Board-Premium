import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';

export interface CreateAuditLogDto {
  actorId?: string | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(dto: CreateAuditLogDto): Promise<AuditLog> {
    const entry = this.auditLogRepository.create({
      actorId: dto.actorId ?? null,
      action: dto.action,
      entityType: dto.entityType ?? null,
      entityId: dto.entityId ?? null,
      metadata: dto.metadata ?? null,
      ipAddress: dto.ipAddress ?? null,
      userAgent: dto.userAgent ?? null,
    });

    const saved = await this.auditLogRepository.save(entry);
    this.logger.debug(
      `Audit: action=${dto.action} actor=${dto.actorId ?? 'system'} entity=${dto.entityType ?? ''}/${dto.entityId ?? ''}`,
    );
    return saved;
  }
}
