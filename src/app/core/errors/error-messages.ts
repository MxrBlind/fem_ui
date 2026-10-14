import { parseApiError } from './api-error';

export const NOT_ALLOWED_MESSAGE = 'No tienes permiso para realizar esta acción.';
export const NOT_FOUND_MESSAGE = 'No se encontró el registro.';
export const CURRENT_CONFLICT_MESSAGE = 'Ya existe un ciclo activo, no es posible activar más';
export const OPEN_FOR_ENROLLMENT_CONFLICT_MESSAGE = 'Ya existe un ciclo abierto a inscripciones';

const CODE_MESSAGES: ReadonlyMap<string, string> = new Map([
  ['ACCESS_DENIED', NOT_ALLOWED_MESSAGE],
  ['ENTITY_NOT_FOUND', NOT_FOUND_MESSAGE]
]);

/** Conflict codes only count on a 409, as the backend never sends them elsewhere. */
const CONFLICT_CODE_MESSAGES: ReadonlyMap<string, string> = new Map([
  ['CYCLE_CURRENT_CONFLICT', CURRENT_CONFLICT_MESSAGE],
  ['CYCLE_OPEN_FOR_ENROLLMENT_CONFLICT', OPEN_FOR_ENROLLMENT_CONFLICT_MESSAGE]
]);

/**
 * Picks the user-facing message for a failed request from its `code` first and
 * its HTTP status second. The server-provided `message` is never shown, so
 * 5xx details cannot leak; anything unmapped returns `fallback`.
 */
export function resolveErrorMessage(err: unknown, fallback: string): string {
  const { status, code } = parseApiError(err);
  if (code !== undefined) {
    const byCode = CODE_MESSAGES.get(code) ?? (status === 409 ? CONFLICT_CODE_MESSAGES.get(code) : undefined);
    if (byCode) return byCode;
  }
  if (status === 403) return NOT_ALLOWED_MESSAGE;
  if (status === 404) return NOT_FOUND_MESSAGE;
  return fallback;
}
