import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../modules/audit/audit.service.js';
import { AUDIT_ACTION_KEY } from '../decorators/audit.decorator.js';
import { AuditAction } from '../enums/audit-action.enum.js';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<AuditAction | undefined>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );

    if (!action) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      user?: { sub?: string };
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
    }>();

    const actorId = request.user?.sub ?? null;
    const ipAddress = request.ip ?? null;
    const userAgent =
      (request.headers?.['user-agent'] as string | undefined) ?? null;

    return next.handle().pipe(
      tap(() => {
        void this.auditService.log({
          actorId,
          action,
          ipAddress,
          userAgent,
        });
      }),
    );
  }
}
