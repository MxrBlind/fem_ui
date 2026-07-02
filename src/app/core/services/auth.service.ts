import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, defer, firstValueFrom, of, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';

import { environment } from '@env/environment';
import {
  AuthUser,
  FALLBACK_HOME_ROUTE,
  ROLE_HOME_ROUTES,
  Role,
  normalizeRole
} from '../auth/rbac';
import { JwtResponse, LoginRequest, UserDto } from '../models/auth.model';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);

  private readonly _currentUser = signal<AuthUser | null>(null);
  readonly currentUser: Signal<AuthUser | null> = this._currentUser.asReadonly();
  readonly role: Signal<Role | null> = computed(() => this._currentUser()?.role ?? null);

  /**
   * Monotonic session counter. Bumped by logout() so any in-flight /me or
   * refreshProfile() resolving after a logout is silently dropped instead of
   * repopulating currentUser. Login starts a new epoch up front for the same
   * reason (rapid re-login after logout).
   */
  private _epoch = 0;
  private inFlightRefresh: Promise<AuthUser | null> | null = null;

  // NOTE: Any HTTP interceptor that adds an `Authorization: Bearer <token>`
  // header MUST skip URLs whose path starts with `/public/`. The public token
  // endpoint must never receive an Authorization header — even when a stored
  // token exists — or it can break login on token refresh / expiry.
  login(credentials: LoginRequest): Observable<AuthUser> {
    const epoch = ++this._epoch;
    return this.http.post<JwtResponse>(`${environment.apiBaseUrl}/public/token`, credentials).pipe(
      tap((jwt) => this.tokenStorage.saveToken(jwt.token, jwt.expirationDate)),
      switchMap(() => this.fetchProfile()),
      tap((user) => {
        if (epoch !== this._epoch) return; // logout raced
        this.adoptUserOrLogout(user, epoch);
      })
    );
  }

  hasRole(role: Role | readonly Role[]): boolean {
    const current = this._currentUser()?.role;
    if (!current) return false;
    return Array.isArray(role) ? role.includes(current) : role === current;
  }

  logout(): void {
    this._epoch++;
    this.inFlightRefresh = null;
    this._currentUser.set(null);
    this.tokenStorage.clear();
    void this.router.navigateByUrl('/login');
  }

  /**
   * Re-fetch /api/user/me. Concurrent callers share the same in-flight promise
   * (HTTP-interceptor de-dup). The result is dropped if logout() ran in the
   * meantime.
   */
  refreshProfile(): Promise<AuthUser | null> {
    if (this.inFlightRefresh) return this.inFlightRefresh;
    const epoch = this._epoch;
    const promise = firstValueFrom(this.fetchProfile()).then(
      (user) => {
        if (epoch === this._epoch) this.adoptUserOrLogout(user, epoch);
        return this._currentUser();
      },
      (err) => {
        if (epoch === this._epoch) this.inFlightRefresh = null;
        throw err;
      }
    );
    this.inFlightRefresh = promise.finally(() => {
      if (this.inFlightRefresh === promise) this.inFlightRefresh = null;
    });
    return this.inFlightRefresh;
  }

  /**
   * Used by the bootstrap initializer. Wraps fetchProfile() in a Promise so the
   * caller can attach a timeout via `Promise.race`. Caller is responsible for
   * deciding what to do with success/failure.
   */
  loadProfileForBootstrap(): Promise<AuthUser> {
    const epoch = this._epoch;
    return firstValueFrom(this.fetchProfile()).then((user) => {
      if (epoch === this._epoch) this.adoptUserOrLogout(user, epoch);
      return user;
    });
  }

  private fetchProfile(): Observable<AuthUser> {
    return defer(() => this.http.get<UserDto>(`${environment.apiBaseUrl}/api/user/me`)).pipe(
      switchMap((dto) => of(this.toAuthUser(dto))),
      catchError((err) => throwError(() => err))
    );
  }

  private toAuthUser(dto: UserDto): AuthUser {
    const { role, rawRole } = normalizeRole(dto.role?.name);
    return { id: dto.id, username: dto.username, role, rawRole };
  }

  /**
   * Adopts a successfully-loaded user, or — if the user has no recognized role —
   * logs out. Centralized so login(), refreshProfile(), and bootstrap behave
   * the same way.
   */
  private adoptUserOrLogout(user: AuthUser, epoch: number): void {
    if (epoch !== this._epoch) return;
    if (!user.role) {
      // Unknown / missing role: backend authorized the token but the role is
      // not one we can route to. Treat as unauthorized for UX purposes.
      this._currentUser.set(null);
      this.tokenStorage.clear();
      void this.router.navigateByUrl('/login', {
        state: { message: 'Sin acceso. Contacta al administrador.' }
      });
      return;
    }
    this._currentUser.set(user);
    this.navigateToRoleHome(user.role);
  }

  private navigateToRoleHome(role: Role): void {
    const target = ROLE_HOME_ROUTES[role];
    if (!target) {
      console.warn(`[AuthService] No ROLE_HOME_ROUTES entry for role "${role}"; using fallback.`);
      void this.router.navigateByUrl(FALLBACK_HOME_ROUTE);
      return;
    }
    void this.router.navigateByUrl(target);
  }
}
