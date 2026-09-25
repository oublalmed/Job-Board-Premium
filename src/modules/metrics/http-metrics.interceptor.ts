import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service.js';

/** Minimal shapes we read off the Express request/response — typed to avoid `any`. */
interface TimedRequest {
  method: string;
  // Populated by the router once a handler matches; absent for 404s / guard
  // rejections that never reach a route.
  route?: { path?: string };
}

interface TimedResponse {
  statusCode: number;
}

/**
 * ENF-09 — times every inbound HTTP request and feeds the
 * `http_request_duration_seconds` histogram.
 *
 * Registered globally via APP_INTERCEPTOR (see MetricsModule).
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<TimedRequest>();
    const response = http.getResponse<TimedResponse>();

    // hrtime gives a monotonic clock immune to wall-clock jumps (NTP/leap
    // seconds), which matters for a latency measurement.
    const startedAt = process.hrtime.bigint();

    const observe = (statusCode: number): void => {
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;

      this.metricsService.httpRequestDuration.observe(
        {
          method: request.method,
          // Matched pattern, not the raw URL — the whole point of the route
          // label is bounded cardinality. Unmatched requests (404s, guard
          // rejections) collapse into a single 'unmatched' series.
          route: request.route?.path ?? 'unmatched',
          status_code: statusCode,
        },
        durationSeconds,
      );
    };

    return next.handle().pipe(
      tap({
        // Success: the response object already carries the final status code.
        next: () => observe(response.statusCode),
        // Error: the exception filter sets the response status only *after* the
        // interceptor chain unwinds, so we read the code off the thrown
        // HttpException here; anything else is an unhandled 500.
        error: (err: unknown) => {
          const statusCode =
            err instanceof HttpException ? err.getStatus() : 500;
          observe(statusCode);
        },
      }),
    );
  }
}
