import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import {
  CreateSubjectRequest,
  SubjectDto,
} from '@features/enrollments/models/enrollment.model';
import { UpdateSubjectRequest } from '@features/subjects/models/update-subject.request';

@Injectable({ providedIn: 'root' })
export class SubjectService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/subject`;

  list(): Observable<SubjectDto[]> {
    return this.http.get<SubjectDto[]>(this.baseUrl);
  }

  create(payload: CreateSubjectRequest): Observable<SubjectDto> {
    return this.http.post<SubjectDto>(this.baseUrl, payload);
  }

  update(id: number, payload: UpdateSubjectRequest): Observable<SubjectDto> {
    return this.http.put<SubjectDto>(`${this.baseUrl}/${id}?includeDependencies=true`, payload);
  }
}
