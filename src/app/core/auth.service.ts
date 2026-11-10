import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';

import { environment } from '../../environments/environment';

export interface RegisterRequest {
  full_name: string;
  dorm_name: string;
  email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  full_name: string;
  dorm_name: string;
  email: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: 'bearer';
  user: AuthUser;
}

export interface UserProfile {
  weekly_allowance: string | null;
  emergency_fund_percent: string;
  equipment: string[];
  food_budget: string | null;
  daily_meal_budget_cap?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiBaseUrl;

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/api/auth/register`, payload)
      .pipe(tap((response) => this.storeToken(response)));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/api/auth/login`, { email, password })
      .pipe(tap((response) => this.storeToken(response)));
  }

  getCurrentUser(): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${this.apiUrl}/api/auth/me`);
  }

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/api/profile`);
  }

  updateProfile(payload: {
    weekly_allowance: number | null;
    emergency_fund_percent: number;
    equipment: string[];
  }): Observable<UserProfile> {
    return this.http.put<UserProfile>(`${this.apiUrl}/api/profile`, payload);
  }

  signOut(): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('nutridorm_access_token');
    }
  }

  private storeToken(response: AuthResponse): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('nutridorm_access_token', response.access_token);
    }
  }
}
