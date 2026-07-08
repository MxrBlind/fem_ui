import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

import { CourseRow } from '@features/enrollments/models/enrollment.model';

export const CONFIRM_TITLE = 'Eliminar curso';
export const CONFIRM_MESSAGE = '¿Estás seguro de borrar este registro?';

export interface CourseDeleteConfirmData {
  row: CourseRow;
}

@Component({
  selector: 'app-course-delete-confirm',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './course-delete-confirm.component.html',
  styleUrl: './course-delete-confirm.component.scss',
})
export class CourseDeleteConfirmComponent {
  private readonly dialogRef = inject(
    MatDialogRef<CourseDeleteConfirmComponent, boolean>
  );
  readonly data = inject<CourseDeleteConfirmData>(MAT_DIALOG_DATA);

  readonly title = CONFIRM_TITLE;
  readonly message = CONFIRM_MESSAGE;

  get summary(): string {
    const { subjectDescription, teacherFullName, categoryTitle } = this.data.row;
    return [subjectDescription, teacherFullName, categoryTitle]
      .filter((p) => !!p)
      .join(' · ');
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
