import { HttpErrorResponse } from '@angular/common/http';

import {
  CURRENT_CONFLICT_MESSAGE,
  NOT_ALLOWED_MESSAGE,
  NOT_FOUND_MESSAGE,
  OPEN_FOR_ENROLLMENT_CONFLICT_MESSAGE,
  REPORT_EXECUTION_FAILED_MESSAGE,
  REPORT_GENERATION_FAILED_MESSAGE,
  REPORT_UNSAFE_QUERY_MESSAGE,
  resolveErrorMessage
} from './error-messages';

const FALLBACK = 'Generic failure';

function httpError(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, statusText: 'x' });
}

describe('resolveErrorMessage', () => {
  it('maps 403 to the not-allowed message, with or without a code', () => {
    expect(resolveErrorMessage(httpError(403, { code: 'ACCESS_DENIED' }), FALLBACK)).toBe(NOT_ALLOWED_MESSAGE);
    expect(resolveErrorMessage(httpError(403, { path: '/api/cycle' }), FALLBACK)).toBe(NOT_ALLOWED_MESSAGE);
  });

  it('maps 404 / ENTITY_NOT_FOUND to the not-found message', () => {
    expect(resolveErrorMessage(httpError(404, { code: 'ENTITY_NOT_FOUND' }), FALLBACK)).toBe(NOT_FOUND_MESSAGE);
    expect(resolveErrorMessage(httpError(404, null), FALLBACK)).toBe(NOT_FOUND_MESSAGE);
  });

  it('keeps the cycle conflict messages', () => {
    expect(resolveErrorMessage(httpError(409, { code: 'CYCLE_CURRENT_CONFLICT' }), FALLBACK)).toBe(
      CURRENT_CONFLICT_MESSAGE
    );
    expect(
      resolveErrorMessage(httpError(409, { code: 'CYCLE_OPEN_FOR_ENROLLMENT_CONFLICT' }), FALLBACK)
    ).toBe(OPEN_FOR_ENROLLMENT_CONFLICT_MESSAGE);
  });

  it('maps the report error codes to their Spanish messages, never to the server message', () => {
    expect(
      resolveErrorMessage(httpError(400, { code: 'UNSAFE_QUERY', message: 'The query is not allowed.' }), FALLBACK)
    ).toBe(REPORT_UNSAFE_QUERY_MESSAGE);
    expect(
      resolveErrorMessage(
        httpError(422, { code: 'REPORT_EXECUTION_FAILED', message: 'The report query could not be executed.' }),
        FALLBACK
      )
    ).toBe(REPORT_EXECUTION_FAILED_MESSAGE);
    expect(
      resolveErrorMessage(httpError(502, { code: 'REPORT_GENERATION_FAILED', message: 'x' }), FALLBACK)
    ).toBe(REPORT_GENERATION_FAILED_MESSAGE);
  });

  it('never exposes the server message on 5xx', () => {
    const result = resolveErrorMessage(
      httpError(500, { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' }),
      FALLBACK
    );

    expect(result).toBe(FALLBACK);
  });

  it('falls back for other statuses, unknown codes and non-HTTP errors', () => {
    expect(resolveErrorMessage(httpError(409, { code: 'CONFLICT', message: 'x' }), FALLBACK)).toBe(FALLBACK);
    expect(resolveErrorMessage(httpError(400, { code: 'VALIDATION_FAILED' }), FALLBACK)).toBe(FALLBACK);
    expect(resolveErrorMessage(new Error('x'), FALLBACK)).toBe(FALLBACK);
  });
});
