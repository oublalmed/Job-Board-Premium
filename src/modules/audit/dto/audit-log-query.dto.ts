import { IsOptional, IsEnum, IsString, IsISO8601 } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { AuditAction } from '../../../common/enums/audit-action.enum.js';

/**
 * Read-side filter for the audit trail (EF-ADM-04). All fields are optional;
 * an empty query returns the most recent entries, newest first.
 */
export class AuditLogQueryDto extends PaginationDto {
  /** Exact action match, e.g. `user.login`. */
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  /** Filter by the actor (user id) who performed the action. */
  @IsOptional()
  @IsString()
  actorId?: string;

  /** Filter by the affected entity type, e.g. `user`, `score`. */
  @IsOptional()
  @IsString()
  entityType?: string;

  /** Filter by a specific affected entity id. */
  @IsOptional()
  @IsString()
  entityId?: string;

  /** Inclusive lower bound on `createdAt` (ISO-8601). */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Inclusive upper bound on `createdAt` (ISO-8601). */
  @IsOptional()
  @IsISO8601()
  to?: string;
}
