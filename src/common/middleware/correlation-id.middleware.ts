import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// ENF-09 (observability) — attach a stable correlation id to every request so
// logs, metrics and (later) traces for one request can be tied together across
// the system. Honours an inbound `x-request-id` (set by an upstream proxy/LB or
// a caller) when present and well-formed, otherwise mints a uuid v4. The id is
// exposed back on the response header so clients and log aggregators can
// cross-reference it.
export const REQUEST_ID_HEADER = 'x-request-id';

// A permissive but bounded shape: printable ASCII, capped length, to avoid
// header-injection or unbounded log lines from an untrusted inbound value.
const SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/;

export interface RequestWithId extends Request {
  correlationId?: string;
}

export function correlationIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
): void {
  const inbound = req.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(inbound) ? inbound[0] : inbound;
  const id = candidate && SAFE_ID.test(candidate) ? candidate : uuidv4();

  req.correlationId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
