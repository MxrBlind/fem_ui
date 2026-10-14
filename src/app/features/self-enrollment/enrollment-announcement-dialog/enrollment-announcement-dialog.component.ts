import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { filter } from 'rxjs';

import { CycleDto } from '@features/enrollments/models/cycle.model';

export const ANNOUNCEMENT_TITLE = 'Inscripciones abiertas';
export const DONT_SHOW_AGAIN_LABEL = 'No volver a mostrar';
export const CLOSE_LABEL = 'Cerrar';

export function buildAnnouncementMessage(description: string): string {
  return `El ciclo ${description} está abierto para inscripciones. Utiliza la opción del menú 'Preinscripciones' para seleccionar tus siguientes materias`;
}

export interface EnrollmentAnnouncementDialogData {
  cycle: CycleDto;
}

export interface EnrollmentAnnouncementDialogResult {
  dontShowAgain: boolean;
}

/**
 * Opened with `disableClose: true` so that Escape and backdrop clicks are
 * routed through close() and always report the checkbox state; Material's
 * built-in close paths would resolve afterClosed() with `undefined`.
 */
@Component({
  selector: 'app-enrollment-announcement-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatCheckboxModule],
  templateUrl: './enrollment-announcement-dialog.component.html',
  styleUrl: './enrollment-announcement-dialog.component.scss',
  host: { 'data-testid': 'enrollment-announcement-dialog' },
})
export class EnrollmentAnnouncementDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<EnrollmentAnnouncementDialogComponent, EnrollmentAnnouncementDialogResult>
  );
  private readonly data = inject<EnrollmentAnnouncementDialogData>(MAT_DIALOG_DATA);

  readonly title = ANNOUNCEMENT_TITLE;
  readonly dontShowAgainLabel = DONT_SHOW_AGAIN_LABEL;
  readonly closeLabel = CLOSE_LABEL;
  readonly message = buildAnnouncementMessage(this.data.cycle.description);
  readonly dontShowAgain = signal(false);

  constructor() {
    this.dialogRef
      .backdropClick()
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.close());
    this.dialogRef
      .keydownEvents()
      .pipe(
        filter((event) => event.key === 'Escape' && !event.defaultPrevented),
        takeUntilDestroyed()
      )
      .subscribe(() => this.close());
  }

  close(): void {
    this.dialogRef.close({ dontShowAgain: this.dontShowAgain() });
  }
}
