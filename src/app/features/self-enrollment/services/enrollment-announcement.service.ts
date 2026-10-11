import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';

import { AuthService } from '@core/services/auth.service';
import { CycleService } from '@core/services/cycle.service';
import { CycleDto } from '@features/enrollments/models/cycle.model';
import {
  EnrollmentAnnouncementDialogComponent,
  EnrollmentAnnouncementDialogData,
  EnrollmentAnnouncementDialogResult,
} from '../enrollment-announcement-dialog/enrollment-announcement-dialog.component';

/**
 * Per-user key holding the id of the last cycle the student dismissed.
 * Intentionally NOT cleared on logout (TokenStorageService.clear()).
 */
export const ENROLLMENT_ANNOUNCEMENT_KEY_PREFIX = 'fem.enrollmentAnnouncement.dismissedCycleId.';

@Injectable({ providedIn: 'root' })
export class EnrollmentAnnouncementService {
  private readonly auth = inject(AuthService);
  private readonly cycleService = inject(CycleService);
  private readonly dialog = inject(MatDialog);

  /**
   * Shows the "cycle open for enrollment" dialog to students who have not
   * dismissed the currently open cycle. The student role gate is mandatory:
   * the backend answers 401 to other roles, which the auth interceptor treats
   * as an expired session.
   */
  checkAndAnnounce(destroyRef: DestroyRef): void {
    const user = this.auth.currentUser();
    if (user?.role !== 'student') return;

    this.cycleService
      .getOpenForEnrollment()
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe({
        next: (cycle) => {
          if (!cycle || cycle.id == null) return;
          if (this.isDismissed(user.id, cycle.id)) return;
          this.openDialog(user.id, cycle);
        },
        error: (err: unknown) =>
          console.warn('[EnrollmentAnnouncement] Failed to load open-for-enrollment cycle', err),
      });
  }

  private openDialog(userId: number, cycle: CycleDto): void {
    const cycleId = cycle.id as number;
    this.dialog
      .open<
        EnrollmentAnnouncementDialogComponent,
        EnrollmentAnnouncementDialogData,
        EnrollmentAnnouncementDialogResult
      >(EnrollmentAnnouncementDialogComponent, {
        data: { cycle },
        // Escape/backdrop are handled by the dialog so the result always
        // carries the checkbox state.
        disableClose: true,
      })
      .afterClosed()
      .subscribe((result) => {
        if (result?.dontShowAgain) this.markDismissed(userId, cycleId);
      });
  }

  private isDismissed(userId: number, cycleId: number): boolean {
    try {
      return localStorage.getItem(this.keyFor(userId)) === String(cycleId);
    } catch {
      return false;
    }
  }

  private markDismissed(userId: number, cycleId: number): void {
    try {
      localStorage.setItem(this.keyFor(userId), String(cycleId));
    } catch {
      // Storage unavailable (private mode / disabled): the dialog will simply
      // show again next time.
    }
  }

  private keyFor(userId: number): string {
    return `${ENROLLMENT_ANNOUNCEMENT_KEY_PREFIX}${userId}`;
  }
}
