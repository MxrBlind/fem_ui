import { Injectable, signal } from '@angular/core';

const TOKEN_KEY = 'fem.auth.token';
const EXPIRES_AT_KEY = 'fem.auth.tokenExpiresAt';

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  readonly token = signal<string | null>(hasStorage() ? window.localStorage.getItem(TOKEN_KEY) : null);

  saveToken(token: string, expirationDate: string): void {
    if (!hasStorage()) {
      this.token.set(token);
      return;
    }
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(EXPIRES_AT_KEY, expirationDate);
    this.token.set(token);
  }

  getToken(): string | null {
    if (!hasStorage()) return null;
    return window.localStorage.getItem(TOKEN_KEY);
  }

  getExpiresAt(): string | null {
    if (!hasStorage()) return null;
    return window.localStorage.getItem(EXPIRES_AT_KEY);
  }

  clear(): void {
    if (hasStorage()) {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(EXPIRES_AT_KEY);
    }
    this.token.set(null);
  }
}
