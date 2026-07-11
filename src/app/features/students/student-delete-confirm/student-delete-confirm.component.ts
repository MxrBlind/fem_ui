import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

import { STUDENT_FALLBACK, StudentRow } from '../student-list/student-list.component';

export const CONFIRM_TITLE = 'Eliminar estudiante';
export const CONFIRM_MESSAGE = '¿Estás seguro de borrar este registro?';

export interface StudentDeleteConfirmData {
  row: StudentRow;
}

@Component({
  selector: 'app-student-delete-confirm',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './student-delete-confirm.component.html',
  styleUrl: './student-delete-confirm.component.scss',
})
export class StudentDeleteConfirmComponent {
  private readonly dialogRef = inject(
    MatDialogRef<StudentDeleteConfirmComponent, boolean>
  );
  readonly data = inject<StudentDeleteConfirmData>(MAT_DIALOG_DATA);

  readonly title = CONFIRM_TITLE;
  readonly message = CONFIRM_MESSAGE;

  get summary(): string {
    const { id, name, parentLastName, email } = this.data.row;
    const fullName = [name, parentLastName]
      .filter((value) => value && value !== STUDENT_FALLBACK)
      .join(' ')
      .trim();
    const segments: string[] = [String(id)];
    if (fullName.length > 0) segments.push(fullName);
    if (email && email !== STUDENT_FALLBACK) segments.push(email);
    return segments.join(' · ');
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
