import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

import { CycleRow } from '../cycle-list/cycle-list.component';

export const CONFIRM_TITLE = 'Eliminar ciclo';
export const CONFIRM_MESSAGE = '¿Estás seguro de borrar este registro?';

export interface CycleDeleteConfirmData {
  row: CycleRow;
}

@Component({
  selector: 'app-cycle-delete-confirm',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './cycle-delete-confirm.component.html',
  styleUrl: './cycle-delete-confirm.component.scss',
})
export class CycleDeleteConfirmComponent {
  private readonly dialogRef = inject(
    MatDialogRef<CycleDeleteConfirmComponent, boolean>
  );
  private readonly datePipe = new DatePipe('en-US');
  readonly data = inject<CycleDeleteConfirmData>(MAT_DIALOG_DATA);

  readonly title = CONFIRM_TITLE;
  readonly message = CONFIRM_MESSAGE;

  get summary(): string {
    const { id, description, startDate, endDate } = this.data.row;
    const start = this.datePipe.transform(startDate, 'mediumDate') ?? '';
    const end = this.datePipe.transform(endDate, 'mediumDate') ?? '';
    return `${id} · ${description} · ${start}–${end}`;
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
