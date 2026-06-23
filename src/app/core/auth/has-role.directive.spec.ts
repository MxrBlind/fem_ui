import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../services/auth.service';
import { AuthUser } from './rbac';
import { HasRoleDirective } from './has-role.directive';

const admin: AuthUser = { id: 1, username: 'a', role: 'admin', rawRole: 'admin' };
const teacher: AuthUser = { id: 2, username: 't', role: 'teacher', rawRole: 'teacher' };

@Component({
  standalone: true,
  imports: [HasRoleDirective],
  template: `
    <span *hasRole="'admin'" data-testid="single">single</span>
    <span *hasRole="['admin', 'teacher']" data-testid="array">array</span>
  `
})
class Host {}

describe('HasRoleDirective', () => {
  let currentUser: ReturnType<typeof signal<AuthUser | null>>;

  function setup(initial: AuthUser | null) {
    currentUser = signal<AuthUser | null>(initial);
    const fakeAuth = { currentUser: currentUser.asReadonly() } as unknown as AuthService;
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [{ provide: AuthService, useValue: fakeAuth }]
    });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture;
  }

  function find(fixture: ReturnType<typeof setup>, id: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
  }

  it('renders for matching string role', () => {
    const fixture = setup(admin);
    expect(find(fixture, 'single')).toBeTruthy();
    expect(find(fixture, 'array')).toBeTruthy();
  });

  it('renders array form via OR-semantics', () => {
    const fixture = setup(teacher);
    expect(find(fixture, 'single')).toBeNull(); // 'admin' only
    expect(find(fixture, 'array')).toBeTruthy(); // matches teacher
  });

  it('tolerates null currentUser without throwing', () => {
    const fixture = setup(null);
    expect(find(fixture, 'single')).toBeNull();
    expect(find(fixture, 'array')).toBeNull();
  });

  it('tears down reactively on logout', () => {
    const fixture = setup(admin);
    expect(find(fixture, 'single')).toBeTruthy();
    currentUser.set(null);
    fixture.detectChanges();
    expect(find(fixture, 'single')).toBeNull();
  });
});
