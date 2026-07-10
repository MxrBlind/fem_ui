import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { UserDto } from '@core/models/auth.model';

@Injectable({ providedIn: 'root' })
export class TeacherService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/user`;

  getAll(): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(this.baseUrl, {
      params: new HttpParams().set('role', 'ROLE_TEACHER'),
    });
  }
}
