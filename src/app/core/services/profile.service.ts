import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { ProfileDto, UserDto } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/user`;

  getMe(): Observable<UserDto> {
    return this.http.get<UserDto>(`${this.baseUrl}/me`);
  }

  update(userId: number, profile: ProfileDto): Observable<UserDto> {
    return this.http.put<UserDto>(`${this.baseUrl}/${userId}/profile`, profile);
  }
}
