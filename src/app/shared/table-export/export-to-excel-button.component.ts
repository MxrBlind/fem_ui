import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ExcelExportService } from './excel-export.service';
import { EXPORT_ROW_CAP, ExcelExportConfig } from './excel-export.types';
import {
  ExportRowCapDialogComponent,
  ExportRowCapDialogData,
} from './export-row-cap-dialog.component';

export const EXPORT_BUTTON_LABEL = 'Exportar a Excel';
export const EMPTY_MESSAGE = 'No hay datos para exportar';
export const SUCCESS_MESSAGE = 'Archivo exportado';
export const ERROR_MESSAGE = 'No se pudo exportar el archivo. Intenta de nuevo.';

export type ExcelExportConfigFactory<T> = () =>
  | Promise<ExcelExportConfig<T>>
  | ExcelExportConfig<T>;

@Component({
  selector: 'app-export-to-excel-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  template: `
    <button
      mat-stroked-button
      type="button"
      color="primary"
      [attr.aria-label]="label"
      [disabled]="isDisabled()"
      data-testid="export-to-excel-btn"
      (click)="onClick()"
    >
      @if (loading()) {
        <mat-progress-spinner
          diameter="18"
          mode="indeterminate"
          data-testid="export-to-excel-spinner"
        />
      } @else {
        <mat-icon>download</mat-icon>
      }
      {{ label }}
    </button>
    <span
      aria-live="polite"
      class="visually-hidden"
      data-testid="export-to-excel-status"
    >
      {{ loading() ? 'Generando archivo…' : '' }}
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
      }
      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        border: 0;
      }
    `,
  ],
})
export class ExportToExcelButtonComponent<T = unknown> {
  private readonly service = inject(ExcelExportService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  @Input() config?: ExcelExportConfig<T>;
  @Input() configFactory?: ExcelExportConfigFactory<T>;
  @Input() disabled = false;

  readonly label = EXPORT_BUTTON_LABEL;
  readonly loading = signal(false);

  isDisabled(): boolean {
    if (this.disabled || this.loading()) return true;
    if (this.configFactory) return false;
    return !this.config || this.config.rows.length === 0;
  }

  async onClick(): Promise<void> {
    if (this.isDisabled()) return;
    this.loading.set(true);
    try {
      const cfg = this.configFactory
        ? await this.configFactory()
        : this.config;
      if (!cfg) {
        this.snackBar.open(EMPTY_MESSAGE, 'Cerrar', { duration: 3000 });
        return;
      }
      if (cfg.rows.length === 0) {
        this.snackBar.open(EMPTY_MESSAGE, 'Cerrar', { duration: 3000 });
        return;
      }
      if (cfg.rows.length > EXPORT_ROW_CAP) {
        this.dialog.open<
          ExportRowCapDialogComponent,
          ExportRowCapDialogData
        >(ExportRowCapDialogComponent, {
          width: '420px',
          data: { rowCount: cfg.rows.length, cap: EXPORT_ROW_CAP },
        });
        return;
      }
      await this.service.exportToExcel(cfg);
      this.snackBar.open(SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
    } catch (err) {
      console.error('[export-to-excel-button] export failed', err);
      this.snackBar.open(ERROR_MESSAGE, 'Cerrar', {
        duration: 5000,
        panelClass: 'snackbar-error',
      });
    } finally {
      this.loading.set(false);
    }
  }
}
