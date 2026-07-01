import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { UserDto } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/user`;

  listByRole(role: string): Observable<UserDto[]> {
    const params = new HttpParams().set('role', role);
    return this.http.get<UserDto[]>(this.baseUrl, { params });
  }
}
