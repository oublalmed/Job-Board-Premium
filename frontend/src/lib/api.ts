// Adapter between the frozen openapi-fetch client and TanStack Query.
//
// The API contract is untouched: every request still goes through the
// existing `apiClient` (auth header injection + 401 refresh live in
// auth/api-middleware). This module only translates openapi-fetch's
// `{ data, error, response }` result into Query's throw-on-error
// expectation, and gives errors a typed shape the UI can branch on.

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

interface OpenApiResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

// Best-effort extraction of a human message from a NestJS error body,
// which is typically `{ message: string | string[]; statusCode; error }`.
function messageFromBody(error: unknown, status: number): string {
  const body = error as { message?: string | string[] } | undefined;
  const raw = body?.message;
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return `Request failed (${status})`;
}

/**
 * Unwrap an openapi-fetch result for use as a TanStack Query `queryFn`
 * or `mutationFn` return value. Throws `ApiError` when the backend
 * returned an error so Query drives its `error` state; otherwise returns
 * the typed `data` (which may be `undefined`/void for 204 responses).
 */
export function unwrap<T>(result: OpenApiResult<T>): T {
  if (result.error !== undefined && result.error !== null) {
    throw new ApiError(
      messageFromBody(result.error, result.response.status),
      result.response.status,
      result.error,
    );
  }
  return result.data as T;
}
