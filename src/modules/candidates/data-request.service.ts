import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, type FindOptionsWhere } from 'typeorm';
import {
  DataRequest,
  DataRequestStatus,
  DataRequestType,
} from './entities/data-request.entity.js';
import { CandidateDataService } from './candidate-data.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';

// CNDP loi 09-08 / GDPR art. 12(3): the controller answers a data-subject
// request within one month of receipt.
const SLA_DAYS = 30;

// States a request can still move to from an open state. `completed` and
// `rejected` are terminal.
const OPEN_STATUSES: readonly DataRequestStatus[] = [
  DataRequestStatus.PENDING,
  DataRequestStatus.IN_PROGRESS,
];

export interface SearchDataRequestQuery {
  status?: DataRequestStatus;
  type?: DataRequestType;
  page?: number;
  limit?: number;
}

export interface PaginatedDataRequests {
  items: DataRequest[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

// EF-ADM-03 — orchestrates the CNDP/RGPD request lifecycle: a candidate files
// a request (which lands in the admin queue with a legal deadline), and an
// admin processes it. Resolving an `erasure` request runs the real
// anonymization through CandidateDataService, so the admin decision — not a
// self-service call — is what triggers the destructive action.
@Injectable()
export class DataRequestService {
  private readonly logger = new Logger(DataRequestService.name);

  constructor(
    @InjectRepository(DataRequest)
    private readonly requestRepo: Repository<DataRequest>,
    private readonly candidateDataService: CandidateDataService,
    private readonly auditService: AuditService,
  ) {}

  /** Candidate files a new data-subject request. */
  async create(
    userId: string,
    type: DataRequestType,
    message?: string | null,
  ): Promise<DataRequest> {
    // Guard against a subject spamming the queue with duplicate open requests
    // of the same type — one open request per type is enough for staff to act.
    const existingOpen = await this.requestRepo.findOne({
      where: { userId, type, status: In(OPEN_STATUSES as DataRequestStatus[]) },
    });
    if (existingOpen) {
      throw new ConflictException(
        'An open request of this type already exists',
      );
    }

    const dueAt = new Date(Date.now() + SLA_DAYS * 24 * 60 * 60 * 1000);
    const request = this.requestRepo.create({
      userId,
      type,
      message: message?.trim() ? message.trim() : null,
      status: DataRequestStatus.PENDING,
      dueAt,
    });
    const saved = await this.requestRepo.save(request);

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.DATA_REQUEST_CREATED,
      entityType: 'DataRequest',
      entityId: saved.id,
      metadata: { type },
    });

    return saved;
  }

  /** A subject's own requests, newest first. */
  listForUser(userId: string): Promise<DataRequest[]> {
    return this.requestRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Admin queue — filterable, paginated, most-urgent (soonest due) first. */
  async search(query: SearchDataRequestQuery): Promise<PaginatedDataRequests> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where: FindOptionsWhere<DataRequest> = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.type) {
      where.type = query.type;
    }

    const [items, total] = await this.requestRepo.findAndCount({
      where,
      order: { dueAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      total,
      page,
      limit,
      pageCount: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Admin transitions a request. Only open requests can be updated; resolving
   * an `erasure` to `completed` performs the actual account anonymization.
   */
  async updateStatus(
    id: string,
    adminId: string,
    status: DataRequestStatus,
    resolutionNote?: string | null,
  ): Promise<DataRequest> {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Data request not found');
    }
    if (!OPEN_STATUSES.includes(request.status)) {
      throw new BadRequestException(
        `Request is already ${request.status} and cannot be changed`,
      );
    }

    const isTerminal =
      status === DataRequestStatus.COMPLETED ||
      status === DataRequestStatus.REJECTED;

    // Execute the underlying right when an erasure request is completed. This
    // is the one branch that mutates other data, so it runs before we persist
    // the new status — if anonymization throws, the request stays open.
    if (
      status === DataRequestStatus.COMPLETED &&
      request.type === DataRequestType.ERASURE
    ) {
      await this.candidateDataService.deleteData(request.userId);
      this.logger.log(
        `Erasure request ${request.id} executed for user ${request.userId}`,
      );
    }

    request.status = status;
    request.handledByUserId = adminId;
    request.resolutionNote = resolutionNote?.trim()
      ? resolutionNote.trim()
      : null;
    request.resolvedAt = isTerminal ? new Date() : null;
    const saved = await this.requestRepo.save(request);

    await this.auditService.log({
      actorId: adminId,
      action: AuditAction.DATA_REQUEST_RESOLVED,
      entityType: 'DataRequest',
      entityId: saved.id,
      metadata: {
        type: saved.type,
        status: saved.status,
        subjectUserId: saved.userId,
      },
    });

    return saved;
  }
}
