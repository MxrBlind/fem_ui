import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

export interface ExportRowCapDialogData {
  rowCount: number;
  cap: number;
}

@Component({
  selector: 'app-export-row-cap-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>No se puede exportar</h2>
    <mat-dialog-content>
      <p>
        La selección actual tiene {{ data.rowCount | number }} registros, pero el
        límite por exportación es {{ data.cap | number }}.
      </p>
      <p>Refina los filtros para reducir el tamaño y vuelve a intentarlo.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="close()" cdkFocusInitial>Entendido</button>
    </mat-dialog-actions>
  `,
})
export class ExportRowCapDialogComponent {
  constructor(
    private readonly ref: MatDialogRef<ExportRowCapDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: ExportRowCapDialogData
  ) {}

  close(): void {
    this.ref.close();
  }
}
