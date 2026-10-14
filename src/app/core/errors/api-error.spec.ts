import { HttpErrorResponse } from '@angular/common/http';

import { parseApiError } from './api-error';

function httpError(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, statusText: 'x', url: '/api/x' });
}

describe('parseApiError', () => {
  it('reads status, code and message from the shared JSON body', () => {
    const result = parseApiError(
      httpError(404, {
        status: 404,
        error: 'Not Found',
        message: 'Course with ID 7 was not found.',
        code: 'ENTITY_NOT_FOUND'
      })
    );

    expect(result).toEqual({
      status: 404,
      code: 'ENTITY_NOT_FOUND',
      message: 'Course with ID 7 was not found.',
      fieldErrors: []
    });
  });

  it('parses fieldErrors and ignores malformed entries', () => {
    const result = parseApiError(
      httpError(400, {
        status: 400,
        message: 'Validation failed',
        code: 'VALIDATION_FAILED',
        fieldErrors: [
          { field: 'courseIds', message: 'At least one course is required' },
          { field: 42, message: 'bad field' },
          { message: 'no field' },
          null
        ]
      })
    );

    expect(result.code).toBe('VALIDATION_FAILED');
    expect(result.fieldErrors).toEqual([
      { field: 'courseIds', message: 'At least one course is required' }
    ]);
  });

  it('has no code for the Spring Boot default body', () => {
    const result = parseApiError(
      httpError(403, { timestamp: '2026-01-01', status: 403, error: 'Forbidden', path: '/api/cycle' })
    );

    expect(result.status).toBe(403);
    expect(result.code).toBeUndefined();
    expect(result.fieldErrors).toEqual([]);
  });

  it('tolerates text/plain, empty and null bodies', () => {
    expect(parseApiError(httpError(500, 'boom')).code).toBeUndefined();
    expect(parseApiError(httpError(500, '')).code).toBeUndefined();
    expect(parseApiError(httpError(500, null)).code).toBeUndefined();
    expect(parseApiError(httpError(500, 'boom')).status).toBe(500);
  });

  it('ignores a non-string code', () => {
    expect(parseApiError(httpError(409, { code: 7 })).code).toBeUndefined();
  });

  it('returns status 0 for network errors', () => {
    const result = parseApiError(httpError(0, new ProgressEvent('error')));

    expect(result.status).toBe(0);
    expect(result.code).toBeUndefined();
  });

  it('returns status 0 for non-HTTP errors without throwing', () => {
    expect(parseApiError(new Error('x')).status).toBe(0);
    expect(parseApiError(undefined).status).toBe(0);
    expect(parseApiError('oops').fieldErrors).toEqual([]);
  });
});
