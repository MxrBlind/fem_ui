import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

import { EnrollmentRow } from '../models/enrollment.model';

export const CONFIRM_TITLE = 'Eliminar inscripción';
export const CONFIRM_MESSAGE = '¿Estás seguro de borrar este registro?';

export interface EnrollmentDeleteConfirmData {
  row: EnrollmentRow;
}

@Component({
  selector: 'app-enrollment-delete-confirm',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './enrollment-delete-confirm.component.html',
  styleUrl: './enrollment-delete-confirm.component.scss',
})
export class EnrollmentDeleteConfirmComponent {
  private readonly dialogRef = inject(
    MatDialogRef<EnrollmentDeleteConfirmComponent, boolean>
  );
  readonly data = inject<EnrollmentDeleteConfirmData>(MAT_DIALOG_DATA);

  readonly title = CONFIRM_TITLE;
  readonly message = CONFIRM_MESSAGE;

  get summary(): string {
    const { fullName, subject, category } = this.data.row;
    return [fullName, subject, category].filter((p) => !!p).join(' · ');
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
