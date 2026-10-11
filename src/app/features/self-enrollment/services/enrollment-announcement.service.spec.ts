import { vi } from 'vitest';
import { DestroyRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { Observable, Subject, of, throwError } from 'rxjs';

import { AuthUser, Role } from '@core/auth/rbac';
import { AuthService } from '@core/services/auth.service';
import { CycleService } from '@core/services/cycle.service';
import { CycleDto } from '@features/enrollments/models/cycle.model';
import {
  EnrollmentAnnouncementDialogComponent,
  EnrollmentAnnouncementDialogResult,
} from '../enrollment-announcement-dialog/enrollment-announcement-dialog.component';
import {
  ENROLLMENT_ANNOUNCEMENT_KEY_PREFIX,
  EnrollmentAnnouncementService,
} from './enrollment-announcement.service';

/** Minimal DestroyRef whose destruction can be triggered from the test. */
class FakeDestroyRef implements DestroyRef {
  private callbacks: Array<() => void> = [];
  destroyed = false;
  onDestroy(callback: () => void): () => void {
    this.callbacks.push(callback);
    return () => (this.callbacks = this.callbacks.filter((cb) => cb !== callback));
  }
  destroy(): void {
    this.destroyed = true;
    this.callbacks.forEach((cb) => cb());
    this.callbacks = [];
  }
}

describe('EnrollmentAnnouncementService', () => {
  const STUDENT_ID = 3;
  const keyFor = (userId: number) => `${ENROLLMENT_ANNOUNCEMENT_KEY_PREFIX}${userId}`;

  const openCycle: CycleDto = {
    id: 10,
    description: '2026-B',
    startDate: '2026-07-01T00:00:00Z',
    endDate: '2026-12-15T00:00:00Z',
    current: true,
    openForEnrollment: true,
  };

  let currentUser: ReturnType<typeof signal<AuthUser | null>>;
  let cycleService: { getOpenForEnrollment: ReturnType<typeof vi.fn> };
  let dialog: { open: ReturnType<typeof vi.fn> };
  let afterClosed$: Subject<EnrollmentAnnouncementDialogResult | undefined>;
  let destroyRef: FakeDestroyRef;
  let service: EnrollmentAnnouncementService;

  function user(role: Role | null, id = STUDENT_ID): AuthUser {
    return { id, username: `user${id}`, role, rawRole: role };
  }

  function respondWith(response: Observable<CycleDto | null>): void {
    cycleService.getOpenForEnrollment.mockReturnValue(response);
  }

  beforeEach(() => {
    localStorage.clear();
    currentUser = signal<AuthUser | null>(user('student'));
    cycleService = { getOpenForEnrollment: vi.fn(() => of(openCycle)) };
    afterClosed$ = new Subject();
    dialog = { open: vi.fn(() => ({ afterClosed: () => afterClosed$ })) };
    destroyRef = new FakeDestroyRef();

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser } },
        { provide: CycleService, useValue: cycleService },
        { provide: MatDialog, useValue: dialog },
      ],
    });
    service = TestBed.inject(EnrollmentAnnouncementService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('role gate', () => {
    it.each<Role>(['admin', 'teacher', 'principal'])(
      'does not request the open cycle nor open the dialog for role %s',
      (role) => {
        currentUser.set(user(role));
        service.checkAndAnnounce(destroyRef);
        expect(cycleService.getOpenForEnrollment).not.toHaveBeenCalled();
        expect(dialog.open).not.toHaveBeenCalled();
      }
    );

    it('does nothing when there is no current user', () => {
      currentUser.set(null);
      service.checkAndAnnounce(destroyRef);
      expect(cycleService.getOpenForEnrollment).not.toHaveBeenCalled();
      expect(dialog.open).not.toHaveBeenCalled();
    });
  });

  it('does not open the dialog when no cycle is open', () => {
    respondWith(of(null));
    service.checkAndAnnounce(destroyRef);
    expect(cycleService.getOpenForEnrollment).toHaveBeenCalledTimes(1);
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('opens the dialog with the cycle and disableClose when the cycle was not dismissed', () => {
    service.checkAndAnnounce(destroyRef);
    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(dialog.open).toHaveBeenCalledWith(
      EnrollmentAnnouncementDialogComponent,
      expect.objectContaining({ data: { cycle: openCycle }, disableClose: true })
    );
  });

  it('does not open the dialog when the same cycle was dismissed', () => {
    localStorage.setItem(keyFor(STUDENT_ID), '10');
    service.checkAndAnnounce(destroyRef);
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('opens the dialog when a different cycle was dismissed', () => {
    localStorage.setItem(keyFor(STUDENT_ID), '3');
    service.checkAndAnnounce(destroyRef);
    expect(dialog.open).toHaveBeenCalledTimes(1);
  });

  it('stores the cycle id when closed with dontShowAgain true', () => {
    localStorage.setItem(keyFor(STUDENT_ID), '3');
    service.checkAndAnnounce(destroyRef);
    afterClosed$.next({ dontShowAgain: true });
    afterClosed$.complete();
    expect(localStorage.getItem(keyFor(STUDENT_ID))).toBe('10');
  });

  it.each<[string, EnrollmentAnnouncementDialogResult | undefined]>([
    ['dontShowAgain false', { dontShowAgain: false }],
    ['an undefined result', undefined],
  ])('stores nothing when closed with %s', (_label, result) => {
    service.checkAndAnnounce(destroyRef);
    afterClosed$.next(result);
    afterClosed$.complete();
    expect(localStorage.getItem(keyFor(STUDENT_ID))).toBeNull();
  });

  it('scopes the dismissal per user', () => {
    localStorage.setItem(keyFor(99), '10');
    service.checkAndAnnounce(destroyRef);
    expect(dialog.open).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['409 conflict', 409],
    ['500 server error', 500],
    ['network error', 0],
  ])('fails silently on %s', (_label, status) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = new HttpErrorResponse({ status });
    respondWith(throwError(() => error));
    expect(() => service.checkAndAnnounce(destroyRef)).not.toThrow();
    expect(dialog.open).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[EnrollmentAnnouncement] Failed to load open-for-enrollment cycle',
      error
    );
  });

  it('still opens the dialog and does not throw when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    service.checkAndAnnounce(destroyRef);
    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(() => {
      afterClosed$.next({ dontShowAgain: true });
      afterClosed$.complete();
    }).not.toThrow();
  });

  it('does not open the dialog when the caller is destroyed before the response arrives', () => {
    const response$ = new Subject<CycleDto | null>();
    respondWith(response$);
    service.checkAndAnnounce(destroyRef);
    destroyRef.destroy();
    response$.next(openCycle);
    expect(dialog.open).not.toHaveBeenCalled();
  });
});
