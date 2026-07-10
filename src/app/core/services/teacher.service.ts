import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { UserDto } from '@core/models/auth.model';
import { CreateTeacherRequest } from '@features/teachers/models/create-teacher.request';
import { UpdateTeacherRequest } from '@features/teachers/models/update-teacher.request';

@Injectable({ providedIn: 'root' })
export class TeacherService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/user`;

  getAll(): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(this.baseUrl, {
      params: new HttpParams().set('role', 'ROLE_TEACHER'),
    });
  }

  create(payload: CreateTeacherRequest): Observable<UserDto> {
    return this.http.post<UserDto>(this.baseUrl, payload);
  }

  update(id: number, payload: UpdateTeacherRequest): Observable<UserDto> {
    return this.http.put<UserDto>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
