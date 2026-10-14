import { HttpErrorResponse } from '@angular/common/http';

export interface FieldError {
  field: string;
  message: string;
}

/**
 * Normalized view of a failed API response. `code` is only present when the
 * backend returned the shared `ErrorResponse` JSON body; Spring Boot's default
 * body (URL-rule 401/403), plain-text bodies and network failures carry none,
 * so callers must fall back to `status`.
 */
export interface ApiError {
  status: number;
  code?: string;
  message?: string;
  fieldErrors: FieldError[];
}

/** Normalizes any thrown value into an {@link ApiError}. Never throws. */
export function parseApiError(err: unknown): ApiError {
  if (!(err instanceof HttpErrorResponse)) {
    return { status: 0, fieldErrors: [] };
  }

  const body: unknown = err.error;
  if (!isRecord(body)) {
    return { status: err.status, fieldErrors: [] };
  }

  return {
    status: err.status,
    code: typeof body['code'] === 'string' ? body['code'] : undefined,
    message: typeof body['message'] === 'string' ? body['message'] : undefined,
    fieldErrors: parseFieldErrors(body['fieldErrors'])
  };
}

function parseFieldErrors(value: unknown): FieldError[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) =>
    isRecord(entry) && typeof entry['field'] === 'string' && typeof entry['message'] === 'string'
      ? [{ field: entry['field'], message: entry['message'] }]
      : []
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
