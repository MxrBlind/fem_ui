import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from './token-storage.service';

describe('TokenStorageService', () => {
  let service: TokenStorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(TokenStorageService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('round-trips saveToken / getToken / getExpiresAt', () => {
    service.saveToken('abc.def.ghi', '2026-12-31T23:59:59Z');
    expect(service.getToken()).toBe('abc.def.ghi');
    expect(service.getExpiresAt()).toBe('2026-12-31T23:59:59Z');
    expect(service.token()).toBe('abc.def.ghi');
  });

  it('clear removes both fem.auth.* keys', () => {
    service.saveToken('t', 'e');
    service.clear();
    expect(localStorage.getItem('fem.auth.token')).toBeNull();
    expect(localStorage.getItem('fem.auth.tokenExpiresAt')).toBeNull();
    expect(service.getToken()).toBeNull();
    expect(service.getExpiresAt()).toBeNull();
    expect(service.token()).toBeNull();
  });

  it('safe no-op when window.localStorage is unavailable', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('unavailable');
      }
    });
    try {
      expect(() => service.saveToken('t', 'e')).not.toThrow();
      expect(service.getToken()).toBeNull();
      expect(service.getExpiresAt()).toBeNull();
      expect(() => service.clear()).not.toThrow();
    } finally {
      if (original) {
        Object.defineProperty(window, 'localStorage', original);
      }
    }
  });
});
