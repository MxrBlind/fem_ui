import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '@env/environment';
import {
  CreateEnrollmentRequest,
  EnrollmentDto,
  EnrollmentRow,
} from '@features/enrollments/models/enrollment.model';

@Injectable({ providedIn: 'root' })
export class EnrollmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/enrollment`;

  listAll(): Observable<EnrollmentDto[]> {
    return this.http.get<EnrollmentDto[]>(this.baseUrl);
  }

  listAllAsRows(): Observable<EnrollmentRow[]> {
    return this.listAll().pipe(map((dtos) => dtos.map(toRow)));
  }

  create(payload: CreateEnrollmentRequest): Observable<EnrollmentDto> {
    return this.http.post<EnrollmentDto>(this.baseUrl, payload);
  }

  update(id: number, payload: EnrollmentDto): Observable<EnrollmentDto> {
    return this.http.put<EnrollmentDto>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}

export function toRow(dto: EnrollmentDto): EnrollmentRow {
  return {
    id: dto.id ?? 0,
    fullName: deriveFullName(dto),
    church: dto.student?.profile?.church ?? '',
    subject: dto.course?.subject?.description ?? '',
    category: dto.course?.subject?.category?.title ?? '',
    grade: dto.grade ?? 0,
    raw: dto,
  };
}

function deriveFullName(dto: EnrollmentDto): string {
  const profile = dto.student?.profile;
  const parts = [profile?.name, profile?.parentLastName, profile?.motherLastName]
    .map((p) => (p ?? '').trim())
    .filter((p) => p.length > 0);
  if (parts.length > 0) return parts.join(' ');
  return dto.student?.username ?? '';
}
