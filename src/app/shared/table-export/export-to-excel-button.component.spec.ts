import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { By } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  EMPTY_MESSAGE,
  ERROR_MESSAGE,
  EXPORT_BUTTON_LABEL,
  ExportToExcelButtonComponent,
  SUCCESS_MESSAGE,
} from './export-to-excel-button.component';
import { ExcelExportService } from './excel-export.service';
import { EXPORT_ROW_CAP, ExcelExportConfig } from './excel-export.types';

interface Row {
  id: number;
}

function baseConfig(count = 1): ExcelExportConfig<Row> {
  return {
    rows: Array.from({ length: count }, (_, i) => ({ id: i + 1 })),
    columns: [{ header: 'ID', key: 'id', value: (r) => r.id }],
    entitySlug: 'widgets',
  };
}

function setup(): {
  fixture: ComponentFixture<ExportToExcelButtonComponent<Row>>;
  service: ExcelExportService;
  snackOpen: ReturnType<typeof vi.spyOn>;
  dialogOpen: ReturnType<typeof vi.spyOn>;
} {
  TestBed.configureTestingModule({
    imports: [ExportToExcelButtonComponent],
    providers: [provideAnimationsAsync()],
  });
  const service = TestBed.inject(ExcelExportService);
  vi.spyOn(service, 'exportToExcel').mockResolvedValue(undefined);
  const snackOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockReturnValue({} as never);
  const dialogOpen = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue({} as never);
  const fixture = TestBed.createComponent<ExportToExcelButtonComponent<Row>>(
    ExportToExcelButtonComponent
  );
  return { fixture, service, snackOpen, dialogOpen };
}

describe('ExportToExcelButtonComponent', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders the button with the localized label and aria-label', () => {
    const { fixture } = setup();
    fixture.componentInstance.config = baseConfig();
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(btn.textContent).toContain(EXPORT_BUTTON_LABEL);
    expect(btn.getAttribute('aria-label')).toBe(EXPORT_BUTTON_LABEL);
  });

  it('is disabled when the filtered set is empty', () => {
    const { fixture } = setup();
    fixture.componentInstance.config = baseConfig(0);
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('is disabled when [disabled] input is set', () => {
    const { fixture } = setup();
    fixture.componentInstance.config = baseConfig();
    fixture.componentInstance.disabled = true;
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('shows the empty snackbar and does not export when configFactory returns empty rows', async () => {
    const { fixture, service, snackOpen } = setup();
    fixture.componentInstance.configFactory = () => baseConfig(0);
    fixture.detectChanges();
    await fixture.componentInstance.onClick();
    expect(service.exportToExcel).not.toHaveBeenCalled();
    expect(snackOpen).toHaveBeenCalledWith(EMPTY_MESSAGE, 'Cerrar', expect.anything());
  });

  it('opens the row-cap dialog and does not export when row count exceeds the cap', async () => {
    const { fixture, service, dialogOpen } = setup();
    const oversized = baseConfig(EXPORT_ROW_CAP + 1);
    fixture.componentInstance.configFactory = () => oversized;
    fixture.detectChanges();
    await fixture.componentInstance.onClick();
    expect(service.exportToExcel).not.toHaveBeenCalled();
    expect(dialogOpen).toHaveBeenCalled();
  });

  it('exports and shows the success snackbar on happy path', async () => {
    const { fixture, service, snackOpen } = setup();
    fixture.componentInstance.config = baseConfig(3);
    fixture.detectChanges();
    await fixture.componentInstance.onClick();
    expect(service.exportToExcel).toHaveBeenCalledOnce();
    expect(snackOpen).toHaveBeenCalledWith(SUCCESS_MESSAGE, 'Cerrar', expect.anything());
  });

  it('shows the error snackbar when the service throws', async () => {
    const { fixture, service, snackOpen } = setup();
    (service.exportToExcel as unknown as { mockRejectedValue: (v: unknown) => void })
      .mockRejectedValue(new Error('boom'));
    fixture.componentInstance.config = baseConfig(3);
    fixture.detectChanges();
    await fixture.componentInstance.onClick();
    expect(snackOpen).toHaveBeenCalledWith(
      ERROR_MESSAGE,
      'Cerrar',
      expect.objectContaining({ panelClass: 'snackbar-error' })
    );
  });
});
