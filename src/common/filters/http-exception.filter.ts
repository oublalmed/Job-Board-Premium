import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
  [key: string]: unknown;
}

// Keys already surfaced explicitly below — never let an exception's own
// payload override the filter's own derivation of these (e.g. a stray
// `statusCode` inside a class-validator body must not shadow the real
// HTTP status resolved from `exception.getStatus()`).
const RESERVED_KEYS = new Set([
  'statusCode',
  'error',
  'message',
  'timestamp',
  'path',
]);

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url: string }>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';
    const extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp['message'] as string | string[]) ?? exception.message;
        error = (resp['error'] as string) ?? 'Error';
        // Structured, non-secret context an exception deliberately attaches
        // (e.g. ConflictException({ message, reEligibleAt }) for the
        // assessment cooldown) — passed through so the client actually
        // receives it, instead of being silently dropped as it was before.
        for (const [key, value] of Object.entries(resp)) {
          if (!RESERVED_KEYS.has(key)) {
            extra[key] = value;
          }
        }
      } else {
        message = exception.message;
      }
    } else {
      this.logger.error(
        'Unhandled exception',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorResponseBody = {
      ...extra,
      statusCode,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(body);
  }
}
