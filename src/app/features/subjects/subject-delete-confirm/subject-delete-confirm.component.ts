import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

import {
  SUBJECT_FALLBACK,
  SubjectRow,
} from '../subject-list/subject-list.component';

export const CONFIRM_TITLE = 'Eliminar materia';
export const CONFIRM_MESSAGE = '¿Estás seguro de borrar este registro?';

export interface SubjectDeleteConfirmData {
  row: SubjectRow;
}

@Component({
  selector: 'app-subject-delete-confirm',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './subject-delete-confirm.component.html',
  styleUrl: './subject-delete-confirm.component.scss',
})
export class SubjectDeleteConfirmComponent {
  private readonly dialogRef = inject(
    MatDialogRef<SubjectDeleteConfirmComponent, boolean>
  );
  readonly data = inject<SubjectDeleteConfirmData>(MAT_DIALOG_DATA);

  readonly title = CONFIRM_TITLE;
  readonly message = CONFIRM_MESSAGE;

  get summary(): string {
    const { id, code, description } = this.data.row;
    return [String(id), code, description]
      .filter((segment) => {
        const trimmed = segment?.trim() ?? '';
        return trimmed.length > 0 && trimmed !== SUBJECT_FALLBACK;
      })
      .join(' · ');
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
