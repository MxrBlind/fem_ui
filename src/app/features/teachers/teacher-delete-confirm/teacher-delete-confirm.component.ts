import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

import { TEACHER_FALLBACK, TeacherRow } from '../teacher-list/teacher-list.component';

export const CONFIRM_TITLE = 'Eliminar maestro';
export const CONFIRM_MESSAGE = '¿Estás seguro de borrar este registro?';

export interface TeacherDeleteConfirmData {
  row: TeacherRow;
}

@Component({
  selector: 'app-teacher-delete-confirm',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './teacher-delete-confirm.component.html',
  styleUrl: './teacher-delete-confirm.component.scss',
})
export class TeacherDeleteConfirmComponent {
  private readonly dialogRef = inject(
    MatDialogRef<TeacherDeleteConfirmComponent, boolean>
  );
  readonly data = inject<TeacherDeleteConfirmData>(MAT_DIALOG_DATA);

  readonly title = CONFIRM_TITLE;
  readonly message = CONFIRM_MESSAGE;

  get summary(): string {
    const { id, name, parentLastName, email } = this.data.row;
    const fullName = [name, parentLastName]
      .filter((value) => value && value !== TEACHER_FALLBACK)
      .join(' ')
      .trim();
    const segments: string[] = [String(id)];
    if (fullName.length > 0) segments.push(fullName);
    if (email && email !== TEACHER_FALLBACK) segments.push(email);
    return segments.join(' · ');
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
