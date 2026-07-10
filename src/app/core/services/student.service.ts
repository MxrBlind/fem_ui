import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { UserDto } from '@core/models/auth.model';
import { CreateStudentRequest } from '@features/students/models/create-student.request';

@Injectable({ providedIn: 'root' })
export class StudentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/user`;

  getAll(): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(this.baseUrl, {
      params: new HttpParams().set('role', 'ROLE_STUDENT'),
    });
  }

  create(payload: CreateStudentRequest): Observable<UserDto> {
    return this.http.post<UserDto>(this.baseUrl, payload);
  }
}
