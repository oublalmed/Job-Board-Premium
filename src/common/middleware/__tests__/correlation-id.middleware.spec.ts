import type { Response } from 'express';
import {
  correlationIdMiddleware,
  REQUEST_ID_HEADER,
  type RequestWithId,
} from '../correlation-id.middleware.js';

function makeCtx(headerValue?: string | string[]) {
  const req = { headers: {} } as RequestWithId;
  if (headerValue !== undefined) req.headers[REQUEST_ID_HEADER] = headerValue;
  const setHeader = jest.fn();
  const res = { setHeader } as unknown as Response;
  const next = jest.fn();
  return { req, res, next, setHeader };
}

describe('correlationIdMiddleware (ENF-09)', () => {
  it('mints a uuid when no inbound id is present and echoes it on the response', () => {
    const { req, res, next, setHeader } = makeCtx();
    correlationIdMiddleware(req, res, next);

    expect(req.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      req.correlationId,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('honours a well-formed inbound id', () => {
    const { req, res, next, setHeader } = makeCtx('req-abc_123');
    correlationIdMiddleware(req, res, next);

    expect(req.correlationId).toBe('req-abc_123');
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'req-abc_123');
  });

  it('rejects an unsafe inbound id (injection / too long) and mints a fresh one', () => {
    const { req, res } = makeCtx('bad id\r\nInjected: 1');
    correlationIdMiddleware(req, res, jest.fn());
    expect(req.correlationId).not.toContain('Injected');
    expect(req.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('takes the first value when the header arrives as an array', () => {
    const { req, res } = makeCtx(['first-id', 'second-id']);
    correlationIdMiddleware(req, res, jest.fn());
    expect(req.correlationId).toBe('first-id');
  });
});
