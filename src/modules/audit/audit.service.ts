import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  type FindOptionsWhere,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
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

export interface SearchAuditLogQuery {
  action?: AuditAction;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedAuditLogs {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
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

  /**
   * Read side of the audit trail (EF-ADM-04). Supports filtering by action,
   * actor, affected entity and a `createdAt` window, with stable
   * newest-first ordering and page-based pagination. Deliberately read-only:
   * audit entries are append-only and never mutated through this path.
   */
  async search(query: SearchAuditLogQuery): Promise<PaginatedAuditLogs> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where: FindOptionsWhere<AuditLog> = {};
    if (query.action) where.action = query.action;
    if (query.actorId) where.actorId = query.actorId;
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;

    const createdAt = this.buildDateRange(query.from, query.to);
    if (createdAt) where.createdAt = createdAt;

    const [items, total] = await this.auditLogRepository.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      total,
      page,
      limit,
      pageCount: Math.ceil(total / limit),
    };
  }

  private buildDateRange(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    if (fromDate && toDate) return Between(fromDate, toDate);
    if (fromDate) return MoreThanOrEqual(fromDate);
    if (toDate) return LessThanOrEqual(toDate);
    return undefined;
  }
}
