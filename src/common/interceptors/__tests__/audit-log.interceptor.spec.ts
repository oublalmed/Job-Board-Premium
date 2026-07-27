import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { AuditLogInterceptor } from '../audit-log.interceptor.js';
import { AuditAction } from '../../enums/audit-action.enum.js';

describe('AuditLogInterceptor', () => {
  let interceptor: AuditLogInterceptor;
  let reflector: { get: jest.Mock };
  let auditService: { log: jest.Mock };
  let callHandler: CallHandler;

  beforeEach(() => {
    reflector = { get: jest.fn() };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    interceptor = new AuditLogInterceptor(
      reflector as unknown as Reflector,
      auditService as any,
    );
    callHandler = { handle: () => of('result') };
  });

  const mockContext = (user?: { sub?: string }): ExecutionContext =>
    ({
      getHandler: () => jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          ip: '127.0.0.1',
          headers: { 'user-agent': 'test-agent' },
        }),
      }),
    }) as unknown as ExecutionContext;

  it('should pass through when no audit action metadata', (done) => {
    reflector.get.mockReturnValue(undefined);

    interceptor.intercept(mockContext(), callHandler).subscribe({
      next: (val) => {
        expect(val).toBe('result');
        expect(auditService.log).not.toHaveBeenCalled();
      },
      complete: done,
    });
  });

  it('should log audit action with user info', (done) => {
    reflector.get.mockReturnValue(AuditAction.USER_LOGIN);

    interceptor
      .intercept(mockContext({ sub: 'user-1' }), callHandler)
      .subscribe({
        complete: () => {
          expect(auditService.log).toHaveBeenCalledWith({
            actorId: 'user-1',
            action: AuditAction.USER_LOGIN,
            ipAddress: '127.0.0.1',
            userAgent: 'test-agent',
          });
          done();
        },
      });
  });

  it('should log with null actorId when no user', (done) => {
    reflector.get.mockReturnValue(AuditAction.USER_REGISTERED);

    interceptor.intercept(mockContext(), callHandler).subscribe({
      complete: () => {
        expect(auditService.log).toHaveBeenCalledWith(
          expect.objectContaining({ actorId: null }),
        );
        done();
      },
    });
  });
});
