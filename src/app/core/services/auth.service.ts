import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { JwtResponse, LoginRequest } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  // NOTE: Any future HTTP interceptor that adds an `Authorization: Bearer <token>`
  // header MUST skip URLs whose path starts with `/public/`. The public token
  // endpoint must never receive an Authorization header — even when a stored
  // token exists — or it can break login on token refresh / expiry.
  login(credentials: LoginRequest): Observable<JwtResponse> {
    return this.http.post<JwtResponse>(`${environment.apiBaseUrl}/public/token`, credentials);
  }
}
