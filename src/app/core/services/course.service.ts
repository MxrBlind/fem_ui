import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { UserDto } from '@core/models/auth.model';
import { environment } from '@env/environment';
import {
  CourseDto,
  CourseRow,
  CreateCourseRequest,
} from '@features/enrollments/models/enrollment.model';

@Injectable({ providedIn: 'root' })
export class CourseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/course`;

  listByCycle(cycleId: number): Observable<CourseDto[]> {
    return this.http.get<CourseDto[]>(`${this.baseUrl}/cycle/${cycleId}`);
  }

  listByCycleAsRows(cycleId: number): Observable<CourseRow[]> {
    return this.listByCycle(cycleId).pipe(map((courses) => courses.map(toRow)));
  }

  create(payload: CreateCourseRequest): Observable<CourseDto> {
    return this.http.post<CourseDto>(this.baseUrl, payload);
  }

  update(id: number, payload: CourseDto): Observable<CourseDto> {
    return this.http.put<CourseDto>(
      `${this.baseUrl}/${id}?includeDependencies=true`,
      payload
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}

export function toRow(course: CourseDto): CourseRow {
  return {
    id: course.id ?? 0,
    subjectDescription: course.subject?.description ?? '',
    credits: course.credits ?? 0,
    teacherFullName: deriveTeacherFullName(course.teacher),
    categoryTitle: course.subject?.category?.title ?? '',
    levelTitle: course.subject?.level?.title ?? '',
    raw: course,
  };
}

function deriveTeacherFullName(teacher: UserDto | undefined): string {
  const profile = teacher?.profile;
  const parts = [profile?.name, profile?.parentLastName, profile?.motherLastName]
    .map((p) => (p ?? '').trim())
    .filter((p) => p.length > 0);
  if (parts.length > 0) return parts.join(' ');
  return teacher?.username ?? '';
}
