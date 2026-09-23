import { CallHandler, ExecutionContext, HttpException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { HttpMetricsInterceptor } from '../http-metrics.interceptor.js';
import { MetricsService } from '../metrics.service.js';

describe('HttpMetricsInterceptor (ENF-09)', () => {
  let interceptor: HttpMetricsInterceptor;
  let observe: jest.Mock;
  let metricsService: MetricsService;

  beforeEach(() => {
    observe = jest.fn();
    metricsService = {
      httpRequestDuration: { observe },
    } as unknown as MetricsService;
    interceptor = new HttpMetricsInterceptor(metricsService);
  });

  const mockContext = (
    request: { method: string; route?: { path?: string } },
    response: { statusCode: number },
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    }) as unknown as ExecutionContext;

  it('observes the histogram with the matched route pattern and status', (done) => {
    const context = mockContext(
      { method: 'GET', route: { path: '/candidates/:id' } },
      { statusCode: 200 },
    );
    const next: CallHandler = { handle: () => of('ok') };

    interceptor.intercept(context, next).subscribe({
      complete: () => {
        expect(observe).toHaveBeenCalledTimes(1);
        const [labels, duration] = observe.mock.calls[0] as [
          Record<string, unknown>,
          number,
        ];
        expect(labels).toEqual({
          method: 'GET',
          route: '/candidates/:id',
          status_code: 200,
        });
        expect(typeof duration).toBe('number');
        expect(duration).toBeGreaterThanOrEqual(0);
        done();
      },
    });
  });

  it("labels unmatched requests as 'unmatched'", (done) => {
    const context = mockContext({ method: 'POST' }, { statusCode: 404 });
    const next: CallHandler = { handle: () => of('ok') };

    interceptor.intercept(context, next).subscribe({
      complete: () => {
        expect(observe).toHaveBeenCalledWith(
          expect.objectContaining({ route: 'unmatched', status_code: 404 }),
          expect.any(Number),
        );
        done();
      },
    });
  });

  it('records the status from a thrown HttpException', (done) => {
    const context = mockContext(
      { method: 'GET', route: { path: '/candidates/:id' } },
      // Still the default status here — the exception filter has not run yet.
      { statusCode: 200 },
    );
    const next: CallHandler = {
      handle: () => throwError(() => new HttpException('nope', 403)),
    };

    interceptor.intercept(context, next).subscribe({
      error: () => {
        expect(observe).toHaveBeenCalledWith(
          expect.objectContaining({ status_code: 403 }),
          expect.any(Number),
        );
        done();
      },
    });
  });

  it('records 500 for a non-HttpException error', (done) => {
    const context = mockContext(
      { method: 'GET', route: { path: '/candidates/:id' } },
      { statusCode: 200 },
    );
    const next: CallHandler = {
      handle: () => throwError(() => new Error('boom')),
    };

    interceptor.intercept(context, next).subscribe({
      error: () => {
        expect(observe).toHaveBeenCalledWith(
          expect.objectContaining({ status_code: 500 }),
          expect.any(Number),
        );
        done();
      },
    });
  });
});
