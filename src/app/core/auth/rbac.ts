export type Role = 'admin' | 'student' | 'teacher' | 'principal';

export const KNOWN_ROLES: ReadonlySet<Role> = new Set<Role>([
  'admin',
  'student',
  'teacher',
  'principal'
]);

export const ROLE_HOME_ROUTES: Record<Role, string> = {
  admin: '/dashboard',
  principal: '/dashboard',
  teacher: '/courses',
  student: '/grades'
};

export const FALLBACK_HOME_ROUTE = '/';

export const AUTH_BOOTSTRAP_TIMEOUT_MS = 5000;

export interface AuthUser {
  id: number;
  username: string;
  role: Role | null;
  rawRole: string | null;
}

export function normalizeRole(raw: string | null | undefined): {
  role: Role | null;
  rawRole: string | null;
} {
  if (!raw) return { role: null, rawRole: null };
  const trimmed = String(raw).trim().toLowerCase();
  if (!trimmed) return { role: null, rawRole: null };
  // Spring Security prefixes authorities with `ROLE_`. Strip it so the
  // backend's "ROLE_ADMIN" maps to the logical role "admin".
  const stripped = trimmed.startsWith('role_') ? trimmed.slice('role_'.length) : trimmed;
  const role = (KNOWN_ROLES as ReadonlySet<string>).has(stripped) ? (stripped as Role) : null;
  return { role, rawRole: stripped };
}
