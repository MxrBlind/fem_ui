import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';

import { REPORT_DELETED_MESSAGE, REPORT_UPDATED_MESSAGE } from '@core/errors/error-messages';
import { ReportService } from '@core/services/report.service';
import { ExcelExportService } from '@shared/table-export';
import { ReportResult, SavedReport } from '../models/report.model';
import {
  ReportDeleteConfirmComponent,
  ReportDeleteConfirmResult
} from './report-delete-confirm/report-delete-confirm.component';
import {
  ReportUpdateDialogComponent,
  ReportUpdateDialogResult
} from './report-update/report-update-dialog.component';
import { SavedReportsComponent } from './saved-reports.component';

const LOAD_FAILED_MESSAGE = 'No se pudieron cargar los reportes guardados.';
const RUN_FAILED_MESSAGE = 'No se pudo ejecutar el reporte. Inténtalo de nuevo más tarde.';
const EXECUTION_FAILED_MESSAGE =
  'No se pudo ejecutar el reporte guardado. Es posible que ya no sea válido con los datos actuales.';
const NOT_FOUND_MESSAGE = 'No se encontró el registro.';

function makeResult(overrides: Partial<ReportResult> = {}): ReportResult {
  return {
    reportToken: null,
    interpretation: 'Ciclo actual',
    columns: [
      { name: 'name', label: 'Nombre', type: 'VARCHAR' },
      { name: 'start_date', label: 'Inicio', type: 'DATE' }
    ],
    rows: [
      ['Ana', '2024-01-05'],
      ['Beto', '2024-02-01'],
      ['Carla', '2024-03-09']
    ],
    rowCount: 3,
    executionMs: 8,
    ...overrides
  };
}

const reports: SavedReport[] = [
  {
    id: 11,
    name: 'Zeta alumnos',
    description: 'Ciclo actual',
    originalPrompt: 'prompt secreto uno',
    createdDate: '2026-11-22T01:00:00',
    updatedDate: null,
    lastRunDate: '2026-11-23T08:15:00'
  },
  {
    id: 4,
    name: 'Alfa maestros',
    description: null,
    originalPrompt: 'prompt secreto dos',
    createdDate: '2026-11-20T10:00:00',
    updatedDate: null,
    lastRunDate: null
  },
  {
    id: 7,
    name: 'Beta materias',
    description: '',
    originalPrompt: 'prompt secreto tres',
    createdDate: '2026-11-21T10:00:00',
    updatedDate: null,
    lastRunDate: null
  }
];

interface Harness {
  fixture: ComponentFixture<SavedReportsComponent>;
  el: HTMLElement;
  listSaved: ReturnType<typeof vi.fn>;
  snackOpen: ReturnType<typeof vi.spyOn>;
  dialogOpen: ReturnType<typeof vi.spyOn>;
  /** Emits what the opened dialog closes with (`undefined` when dismissed). */
  dialogClosed: Subject<ReportDeleteConfirmResult | ReportUpdateDialogResult | undefined>;
  navigate: ReturnType<typeof vi.spyOn>;
  navigateByUrl: ReturnType<typeof vi.spyOn>;
  /** Controls the request issued by the page on init. */
  request: Subject<SavedReport[]>;
  execute: ReturnType<typeof vi.fn>;
  /** One subject per `execute` call, in call order. */
  runs: Subject<ReportResult>[];
  exportToExcel: ReturnType<typeof vi.fn>;
}

function setup(): Harness {
  const request = new Subject<SavedReport[]>();
  const listSaved = vi.fn(() => request.asObservable());
  const runs: Subject<ReportResult>[] = [];
  const execute = vi.fn(() => {
    const run = new Subject<ReportResult>();
    runs.push(run);
    return run.asObservable();
  });
  const exportToExcel = vi.fn().mockResolvedValue(undefined);

  TestBed.configureTestingModule({
    imports: [SavedReportsComponent],
    providers: [
      provideAnimationsAsync(),
      provideRouter([]),
      { provide: ReportService, useValue: { listSaved, execute } },
      { provide: ExcelExportService, useValue: { exportToExcel } }
    ]
  });
  const snackOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockReturnValue({} as never);
  const dialogClosed = new Subject<ReportDeleteConfirmResult | ReportUpdateDialogResult | undefined>();
  const dialogOpen = vi
    .spyOn(MatDialog.prototype, 'open')
    .mockReturnValue({ afterClosed: () => dialogClosed.asObservable() } as never);
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

  const fixture = TestBed.createComponent(SavedReportsComponent);
  fixture.detectChanges();

  return {
    fixture,
    el: fixture.nativeElement as HTMLElement,
    listSaved,
    snackOpen,
    dialogOpen,
    dialogClosed,
    navigate,
    navigateByUrl,
    request,
    execute,
    runs,
    exportToExcel
  };
}

function byTestId(el: HTMLElement, id: string): HTMLElement | null {
  return el.querySelector(`[data-testid="${id}"]`);
}

function load(h: Harness, value: SavedReport[] = reports): void {
  h.request.next(value);
  h.request.complete();
  h.fixture.detectChanges();
}

function fail(h: Harness, status: number, body: unknown = null): void {
  h.request.error(new HttpErrorResponse({ status, error: body }));
  h.fixture.detectChanges();
}

function succeedRun(h: Harness, run: number, result: ReportResult = makeResult()): void {
  h.runs[run].next(result);
  h.runs[run].complete();
  h.fixture.detectChanges();
}

function failRun(h: Harness, run: number, status: number, body: unknown = null): void {
  h.runs[run].error(new HttpErrorResponse({ status, error: body }));
  h.fixture.detectChanges();
}

function clickRun(h: Harness): void {
  (byTestId(h.el, 'saved-report-run-btn') as HTMLButtonElement).click();
  h.fixture.detectChanges();
}

async function openPanel(h: Harness): Promise<HTMLElement[]> {
  const select = byTestId(h.el, 'saved-reports-select') as HTMLElement;
  (select.querySelector('.mat-mdc-select-trigger') as HTMLElement).click();
  h.fixture.detectChanges();
  await h.fixture.whenStable();
  return Array.from(document.querySelectorAll('mat-option')) as HTMLElement[];
}

async function selectOption(h: Harness, index: number): Promise<void> {
  const options = await openPanel(h);
  options[index].click();
  h.fixture.detectChanges();
  await h.fixture.whenStable();
  h.fixture.detectChanges();
}

function text(el: HTMLElement | null): string {
  return (el?.textContent ?? '').trim();
}

describe('SavedReportsComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loading', () => {
    it('requests the saved reports once on init', () => {
      const h = setup();

      expect(h.listSaved).toHaveBeenCalledTimes(1);
    });

    it('requests the list again for every new instance, without caching', () => {
      const first = setup();
      load(first);
      first.fixture.destroy();

      const second = TestBed.createComponent(SavedReportsComponent);
      second.detectChanges();

      expect(first.listSaved).toHaveBeenCalledTimes(2);
    });

    it('shows an announced spinner and no select while the request is pending', () => {
      const h = setup();

      const loading = byTestId(h.el, 'saved-reports-loading');
      expect(loading).not.toBeNull();
      expect(loading?.getAttribute('role')).toBe('status');
      expect(loading?.getAttribute('aria-busy')).toBe('true');
      expect(h.el.querySelector('mat-progress-spinner')).not.toBeNull();
      expect(byTestId(h.el, 'saved-reports-select')).toBeNull();
    });

    it('hides the spinner after a successful load', () => {
      const h = setup();
      load(h);

      expect(byTestId(h.el, 'saved-reports-loading')).toBeNull();
    });

    it('hides the spinner after a failed load', () => {
      const h = setup();
      fail(h, 500);

      expect(byTestId(h.el, 'saved-reports-loading')).toBeNull();
    });
  });

  describe('dropdown', () => {
    it('shows a labelled select and no "Reportes guardados:" heading', () => {
      const h = setup();
      load(h);

      expect(byTestId(h.el, 'saved-reports-heading')).toBeNull();
      expect(h.el.textContent).not.toContain('Reportes guardados:');
      const select = byTestId(h.el, 'saved-reports-select');
      expect(select).not.toBeNull();
      expect(text(h.el.querySelector('mat-label'))).toBe('Reporte');
    });

    it('puts the select inside the card right after load, before any selection', () => {
      const h = setup();
      load(h);

      const card = byTestId(h.el, 'saved-report-card') as HTMLElement;
      expect(card).not.toBeNull();
      expect(card.contains(byTestId(h.el, 'saved-reports-select'))).toBe(true);
    });

    it('keeps the select inside the card after a selection', async () => {
      const h = setup();
      load(h);

      await selectOption(h, 0);

      const card = byTestId(h.el, 'saved-report-card') as HTMLElement;
      expect(card.contains(byTestId(h.el, 'saved-reports-select'))).toBe(true);
    });

    it('lists one option per report by name, in the received order', async () => {
      const h = setup();
      load(h);

      const options = await openPanel(h);

      expect(options.map((o) => text(o))).toEqual(['Zeta alumnos', 'Alfa maestros', 'Beta materias']);
    });

    it('selects nothing and shows no details after load', () => {
      const h = setup();
      load(h);

      expect(byTestId(h.el, 'saved-report-card')).not.toBeNull();
      expect(byTestId(h.el, 'saved-reports-select')).not.toBeNull();
      expect(byTestId(h.el, 'saved-report-name')).toBeNull();
      expect(byTestId(h.el, 'saved-report-description')).toBeNull();
      expect(byTestId(h.el, 'saved-report-run-btn')).toBeNull();
      expect(byTestId(h.el, 'saved-report-update-btn')).toBeNull();
      expect(byTestId(h.el, 'saved-report-delete-btn')).toBeNull();
    });
  });

  describe('card structure', () => {
    it('keeps the DOM order field, actions, details so the tab and reading order follow the layout', async () => {
      const h = setup();
      load(h);

      await selectOption(h, 0);

      const select = byTestId(h.el, 'saved-reports-select') as HTMLElement;
      const actions = byTestId(h.el, 'saved-report-actions') as HTMLElement;
      const details = byTestId(h.el, 'saved-report-details') as HTMLElement;
      expect(actions).not.toBeNull();
      expect(details).not.toBeNull();
      const follows = (a: HTMLElement, b: HTMLElement): boolean =>
        Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      expect(follows(select, actions)).toBe(true);
      expect(follows(actions, details)).toBe(true);
    });

    it('places the three buttons in one container, in the order Ejecutar, Actualizar, Borrar', async () => {
      const h = setup();
      load(h);

      await selectOption(h, 0);

      const actions = byTestId(h.el, 'saved-report-actions') as HTMLElement;
      const labels = Array.from(actions.querySelectorAll('button')).map((b) => text(b));
      expect(labels).toEqual(['Ejecutar', 'Actualizar', 'Borrar']);
    });

    it('renders the name and description inside the details block of the card', async () => {
      const h = setup();
      load(h);

      await selectOption(h, 0);

      const card = byTestId(h.el, 'saved-report-card') as HTMLElement;
      const details = byTestId(h.el, 'saved-report-details') as HTMLElement;
      expect(card.contains(details)).toBe(true);
      expect(details.contains(byTestId(h.el, 'saved-report-name'))).toBe(true);
      expect(details.contains(byTestId(h.el, 'saved-report-description'))).toBe(true);
    });
  });

  describe('details', () => {
    it('shows the name and description of the selected report', async () => {
      const h = setup();
      load(h);

      await selectOption(h, 0);

      expect(text(byTestId(h.el, 'saved-report-name'))).toBe('Zeta alumnos');
      expect(text(byTestId(h.el, 'saved-report-description'))).toBe('Ciclo actual');
    });

    it('shows "—" for a null description', async () => {
      const h = setup();
      load(h);

      await selectOption(h, 1);

      expect(text(byTestId(h.el, 'saved-report-description'))).toBe('—');
    });

    it('shows "—" for an empty description', async () => {
      const h = setup();
      load(h);

      await selectOption(h, 2);

      expect(text(byTestId(h.el, 'saved-report-description'))).toBe('—');
    });

    it('replaces the details when another report is selected', async () => {
      const h = setup();
      load(h);

      await selectOption(h, 0);
      await selectOption(h, 1);

      const card = byTestId(h.el, 'saved-report-card') as HTMLElement;
      expect(text(byTestId(h.el, 'saved-report-name'))).toBe('Alfa maestros');
      expect(card.textContent).not.toContain('Zeta alumnos');
      expect(card.textContent).not.toContain('Ciclo actual');
    });

    it('never shows the original prompt or the dates', async () => {
      const h = setup();
      load(h);

      await selectOption(h, 0);

      const page = h.el.textContent ?? '';
      expect(page).not.toContain('prompt secreto');
      expect(page).not.toContain('2026-11-22');
      expect(page).not.toContain('2026-11-23');
      expect(page).not.toContain('22/11/2026');
    });
  });

  describe('action buttons', () => {
    const buttonIds = [
      ['Ejecutar', 'saved-report-run-btn'],
      ['Actualizar', 'saved-report-update-btn'],
      ['Borrar', 'saved-report-delete-btn']
    ] as const;

    it('shows no action button before a report is selected', () => {
      const h = setup();
      load(h);

      for (const [, id] of buttonIds) {
        expect(byTestId(h.el, id)).toBeNull();
      }
    });

    it.each(buttonIds)('renders an enabled "%s" button of type button once a report is selected', async (label, id) => {
      const h = setup();
      load(h);

      await selectOption(h, 0);

      const button = byTestId(h.el, id) as HTMLButtonElement;
      expect(button).not.toBeNull();
      expect(text(button)).toBe(label);
      expect(button.disabled).toBe(false);
      expect(button.getAttribute('type')).toBe('button');
    });

    it('marks only "Borrar" as a danger button and no longer uses the ineffective color attribute', async () => {
      const h = setup();
      load(h);

      await selectOption(h, 0);

      const remove = byTestId(h.el, 'saved-report-delete-btn') as HTMLButtonElement;
      expect(remove.classList.contains('danger-button')).toBe(true);
      expect(remove.hasAttribute('color')).toBe(false);
      for (const id of ['saved-report-run-btn', 'saved-report-update-btn']) {
        const other = byTestId(h.el, id) as HTMLButtonElement;
        expect(other.classList.contains('danger-button')).toBe(false);
      }
    });
  });

  describe('delete a saved report', () => {
    async function ready(list: SavedReport[] = reports): Promise<Harness> {
      const h = setup();
      load(h, list);
      await selectOption(h, 0);
      return h;
    }

    function clickDelete(h: Harness): void {
      (byTestId(h.el, 'saved-report-delete-btn') as HTMLButtonElement).click();
      h.fixture.detectChanges();
    }

    /** Closes the confirmation dialog the way the real one does, then lets the view settle. */
    async function closeDialog(h: Harness, result: ReportDeleteConfirmResult | undefined): Promise<void> {
      h.dialogClosed.next(result);
      h.dialogClosed.complete();
      h.fixture.detectChanges();
      await h.fixture.whenStable();
      h.fixture.detectChanges();
    }

    const resultEl = (h: Harness): HTMLElement | null => byTestId(h.el, 'saved-report-result');

    async function optionNames(h: Harness): Promise<string[]> {
      return (await openPanel(h)).map((option) => text(option));
    }

    describe('opening the dialog', () => {
      it('opens the confirmation dialog with the selected report and sends no request', async () => {
        const h = await ready();

        clickDelete(h);

        expect(h.dialogOpen).toHaveBeenCalledTimes(1);
        const [component, config] = h.dialogOpen.mock.calls[0];
        expect(component).toBe(ReportDeleteConfirmComponent);
        expect(config).toEqual(expect.objectContaining({ data: { report: reports[0] }, disableClose: true }));
        expect(h.listSaved).toHaveBeenCalledTimes(1);
        expect(h.execute).not.toHaveBeenCalled();
        expect(h.snackOpen).not.toHaveBeenCalled();
      });

      it('changes nothing while the dialog is open', async () => {
        const h = await ready();
        clickRun(h);
        h.runs[0].next(makeResult());
        h.runs[0].complete();
        await h.fixture.whenStable();
        h.fixture.detectChanges();
        const before = h.el.innerHTML;

        clickDelete(h);

        expect(h.el.innerHTML).toBe(before);
      });

      it('leaves the options, the selection, the details and the result unchanged when the dialog is dismissed', async () => {
        const h = await ready();
        clickRun(h);
        h.runs[0].next(makeResult());
        h.runs[0].complete();
        await h.fixture.whenStable();
        h.fixture.detectChanges();
        clickDelete(h);
        const before = h.el.innerHTML;

        await closeDialog(h, undefined);

        expect(h.el.innerHTML).toBe(before);
        expect(h.fixture.componentInstance.reports()).toEqual(reports);
        expect(h.fixture.componentInstance.selectedReportId()).toBe(11);
        expect(resultEl(h)).not.toBeNull();
        expect(h.snackOpen).not.toHaveBeenCalled();
        expect(h.listSaved).toHaveBeenCalledTimes(1);
      });
    });

    describe('successful delete', () => {
      it('removes the option, keeps the order of the others and selects nothing', async () => {
        const h = await ready();
        clickDelete(h);

        await closeDialog(h, { outcome: 'deleted' });

        expect(h.fixture.componentInstance.reports().map((report) => report.id)).toEqual([4, 7]);
        expect(h.fixture.componentInstance.selectedReportId()).toBeNull();
        expect(await optionNames(h)).toEqual(['Alfa maestros', 'Beta materias']);
      });

      it('hides the action buttons and the details', async () => {
        const h = await ready();
        clickDelete(h);

        await closeDialog(h, { outcome: 'deleted' });

        expect(byTestId(h.el, 'saved-report-actions')).toBeNull();
        expect(byTestId(h.el, 'saved-report-details')).toBeNull();
        expect(byTestId(h.el, 'saved-report-delete-btn')).toBeNull();
      });

      it('shows the success message and does not reload the list', async () => {
        const h = await ready();
        clickDelete(h);

        await closeDialog(h, { outcome: 'deleted' });

        expect(h.snackOpen).toHaveBeenCalledTimes(1);
        expect(h.snackOpen).toHaveBeenCalledWith(REPORT_DELETED_MESSAGE, 'Cerrar', { duration: 3000 });
        expect(h.listSaved).toHaveBeenCalledTimes(1);
      });

      it('removes the report that was selected when the dialog opened', async () => {
        const h = await ready();
        await selectOption(h, 2);
        clickDelete(h);

        await closeDialog(h, { outcome: 'deleted' });

        expect(h.fixture.componentInstance.reports().map((report) => report.id)).toEqual([11, 4]);
      });

      it('shows the empty-list state when the last report is deleted', async () => {
        const h = await ready([reports[0]]);
        clickDelete(h);

        await closeDialog(h, { outcome: 'deleted' });

        expect(byTestId(h.el, 'saved-reports-empty')).not.toBeNull();
        expect(text(byTestId(h.el, 'saved-reports-empty'))).toContain('No hay reportes guardados.');
        expect(byTestId(h.el, 'saved-reports-select')).toBeNull();
      });

      it('moves focus to the dropdown when other reports remain', async () => {
        const h = await ready();
        clickDelete(h);

        await closeDialog(h, { outcome: 'deleted' });

        expect(document.activeElement).toBe(byTestId(h.el, 'saved-reports-select'));
      });
    });

    describe('ownership of the result', () => {
      it('removes the shown result of the deleted report', async () => {
        const h = await ready();
        clickRun(h);
        h.runs[0].next(makeResult());
        h.runs[0].complete();
        await h.fixture.whenStable();
        h.fixture.detectChanges();
        expect(resultEl(h)).not.toBeNull();
        clickDelete(h);

        await closeDialog(h, { outcome: 'deleted' });

        expect(resultEl(h)).toBeNull();
      });

      it('cancels a run in flight so its late response is never shown', async () => {
        const h = await ready();
        clickRun(h);
        expect(h.runs[0].observed).toBe(true);
        clickDelete(h);

        await closeDialog(h, { outcome: 'deleted' });
        h.runs[0].next(makeResult());
        h.runs[0].complete();
        await h.fixture.whenStable();
        h.fixture.detectChanges();

        expect(h.runs[0].observed).toBe(false);
        expect(h.fixture.componentInstance.executing()).toBe(false);
        expect(resultEl(h)).toBeNull();
      });
    });

    describe('report that no longer exists', () => {
      it('removes it from the list and shows the not-found message', async () => {
        const h = await ready();
        clickDelete(h);

        await closeDialog(h, { outcome: 'not-found' });

        expect(h.fixture.componentInstance.reports().map((report) => report.id)).toEqual([4, 7]);
        expect(h.fixture.componentInstance.selectedReportId()).toBeNull();
        expect(h.snackOpen).toHaveBeenCalledTimes(1);
        expect(h.snackOpen).toHaveBeenCalledWith(NOT_FOUND_MESSAGE, 'Cerrar', {
          duration: 5000,
          panelClass: 'snackbar-error'
        });
        expect(h.listSaved).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('update a saved report', () => {
    /** Sorted by name, like the backend answers, so a re-sort only moves the updated report. */
    const sortedReports: SavedReport[] = [reports[1], reports[2], reports[0]];

    async function ready(list: SavedReport[] = sortedReports): Promise<Harness> {
      const h = setup();
      load(h, list);
      await selectOption(h, 0);
      return h;
    }

    function clickUpdate(h: Harness): void {
      (byTestId(h.el, 'saved-report-update-btn') as HTMLButtonElement).click();
      h.fixture.detectChanges();
    }

    /** Closes the edit dialog the way the real one does, then lets the view settle. */
    async function closeDialog(h: Harness, result: ReportUpdateDialogResult | undefined): Promise<void> {
      h.dialogClosed.next(result);
      h.dialogClosed.complete();
      h.fixture.detectChanges();
      await h.fixture.whenStable();
      h.fixture.detectChanges();
    }

    /** The result the dialog closes with after the backend answered `200` for the first report. */
    const updated = (overrides: Partial<SavedReport>): ReportUpdateDialogResult => ({
      outcome: 'updated',
      report: { ...sortedReports[0], updatedDate: '2026-11-26T10:30:00', ...overrides }
    });

    const resultEl = (h: Harness): HTMLElement | null => byTestId(h.el, 'saved-report-result');

    async function optionNames(h: Harness): Promise<string[]> {
      return (await openPanel(h)).map((option) => text(option));
    }

    async function runAndShowResult(h: Harness): Promise<void> {
      clickRun(h);
      h.runs[0].next(makeResult());
      h.runs[0].complete();
      await h.fixture.whenStable();
      h.fixture.detectChanges();
    }

    describe('opening the dialog', () => {
      it('opens the edit dialog with the selected report and sends no request', async () => {
        const h = await ready();

        clickUpdate(h);

        expect(h.dialogOpen).toHaveBeenCalledTimes(1);
        const [component, config] = h.dialogOpen.mock.calls[0];
        expect(component).toBe(ReportUpdateDialogComponent);
        expect(config).toEqual(expect.objectContaining({ data: { report: sortedReports[0] }, disableClose: true }));
        expect(h.listSaved).toHaveBeenCalledTimes(1);
        expect(h.execute).not.toHaveBeenCalled();
        expect(h.snackOpen).not.toHaveBeenCalled();
        expect(h.navigate).not.toHaveBeenCalled();
      });

      it('opens the dialog for the report that is currently selected', async () => {
        const h = await ready();
        await selectOption(h, 1);

        clickUpdate(h);

        expect(h.dialogOpen.mock.calls[0][1]).toEqual(expect.objectContaining({ data: { report: sortedReports[1] } }));
      });

      it('changes nothing while the dialog is open', async () => {
        const h = await ready();
        await runAndShowResult(h);
        const before = h.el.innerHTML;

        clickUpdate(h);

        expect(h.el.innerHTML).toBe(before);
      });

      it('leaves the options, the selection, the details and the result unchanged when the dialog is dismissed', async () => {
        const h = await ready();
        await runAndShowResult(h);
        clickUpdate(h);
        const before = h.el.innerHTML;

        await closeDialog(h, undefined);

        expect(h.el.innerHTML).toBe(before);
        expect(h.fixture.componentInstance.reports()).toEqual(sortedReports);
        expect(h.fixture.componentInstance.selectedReportId()).toBe(4);
        expect(resultEl(h)).not.toBeNull();
        expect(h.snackOpen).not.toHaveBeenCalled();
        expect(h.listSaved).toHaveBeenCalledTimes(1);
      });
    });

    describe('successful update', () => {
      it('shows the new name in the details and keeps the report selected', async () => {
        const h = await ready();
        clickUpdate(h);

        await closeDialog(h, updated({ name: 'Zona norte' }));

        expect(h.fixture.componentInstance.selectedReportId()).toBe(4);
        expect(text(byTestId(h.el, 'saved-report-details'))).toContain('Zona norte');
        expect(text(byTestId(h.el, 'saved-report-details'))).not.toContain('Alfa maestros');
      });

      it('keeps the options ordered by name after a rename that moves the report', async () => {
        const h = await ready();
        clickUpdate(h);

        await closeDialog(h, updated({ name: 'Zona norte' }));

        expect(h.fixture.componentInstance.reports().map((report) => report.id)).toEqual([7, 11, 4]);
        expect(await optionNames(h)).toEqual(['Beta materias', 'Zeta alumnos', 'Zona norte']);
      });

      it('keeps the position of a report whose new name sorts in the same place', async () => {
        const h = await ready();
        clickUpdate(h);

        await closeDialog(h, updated({ name: 'Alfa docentes' }));

        expect(h.fixture.componentInstance.reports().map((report) => report.id)).toEqual([4, 7, 11]);
      });

      it('sorts regardless of letter case and accents', async () => {
        const h = await ready();
        clickUpdate(h);

        await closeDialog(h, updated({ name: 'álamo' }));

        expect(h.fixture.componentInstance.reports().map((report) => report.id)).toEqual([4, 7, 11]);
      });

      it('shows "—" in the details when the description was cleared', async () => {
        const h = await ready([reports[0]]);
        await selectOption(h, 0);
        expect(text(byTestId(h.el, 'saved-report-details'))).toContain('Ciclo actual');
        clickUpdate(h);

        await closeDialog(h, updated({ id: 11, name: 'Zeta alumnos', description: null }));

        expect(text(byTestId(h.el, 'saved-report-details'))).toContain('—');
        expect(text(byTestId(h.el, 'saved-report-details'))).not.toContain('Ciclo actual');
      });

      it('shows the success message and does not reload the list', async () => {
        const h = await ready();
        clickUpdate(h);

        await closeDialog(h, updated({ name: 'Zona norte' }));

        expect(h.snackOpen).toHaveBeenCalledTimes(1);
        expect(h.snackOpen).toHaveBeenCalledWith(REPORT_UPDATED_MESSAGE, 'Cerrar', { duration: 3000 });
        expect(h.listSaved).toHaveBeenCalledTimes(1);
      });

      it('replaces the list instead of mutating the previous one', async () => {
        const h = await ready();
        const previous = h.fixture.componentInstance.reports();
        const previousIds = previous.map((report) => report.id);
        clickUpdate(h);

        await closeDialog(h, updated({ name: 'Zona norte' }));

        expect(h.fixture.componentInstance.reports()).not.toBe(previous);
        expect(previous.map((report) => report.id)).toEqual(previousIds);
        expect(previous[0].name).toBe('Alfa maestros');
      });

      it('keeps the actions visible and leaves focus on the "Actualizar" button', async () => {
        const h = await ready();
        const updateButton = byTestId(h.el, 'saved-report-update-btn') as HTMLButtonElement;
        updateButton.focus();
        clickUpdate(h);

        await closeDialog(h, updated({ name: 'Zona norte' }));

        expect(byTestId(h.el, 'saved-report-actions')).not.toBeNull();
        expect(document.activeElement).toBe(byTestId(h.el, 'saved-report-update-btn'));
      });
    });

    describe('ownership of the result', () => {
      it('keeps the shown result after an update', async () => {
        const h = await ready();
        await runAndShowResult(h);
        clickUpdate(h);

        await closeDialog(h, updated({ name: 'Zona norte' }));

        expect(resultEl(h)).not.toBeNull();
        expect(h.fixture.componentInstance.result()).not.toBeNull();
      });

      it('does not cancel a run in flight and shows its response when it arrives', async () => {
        const h = await ready();
        clickRun(h);
        clickUpdate(h);

        await closeDialog(h, updated({ description: 'Nueva descripción' }));
        expect(h.runs[0].observed).toBe(true);
        expect(h.fixture.componentInstance.executing()).toBe(true);
        h.runs[0].next(makeResult());
        h.runs[0].complete();
        await h.fixture.whenStable();
        h.fixture.detectChanges();

        expect(resultEl(h)).not.toBeNull();
        expect(h.fixture.componentInstance.executing()).toBe(false);
      });
    });

    describe('report that no longer exists', () => {
      it('removes it from the list and shows the not-found message', async () => {
        const h = await ready();
        clickUpdate(h);

        await closeDialog(h, { outcome: 'not-found' });

        expect(h.fixture.componentInstance.reports().map((report) => report.id)).toEqual([7, 11]);
        expect(h.fixture.componentInstance.selectedReportId()).toBeNull();
        expect(byTestId(h.el, 'saved-report-actions')).toBeNull();
        expect(byTestId(h.el, 'saved-report-details')).toBeNull();
        expect(h.snackOpen).toHaveBeenCalledTimes(1);
        expect(h.snackOpen).toHaveBeenCalledWith(NOT_FOUND_MESSAGE, 'Cerrar', {
          duration: 5000,
          panelClass: 'snackbar-error'
        });
        expect(h.listSaved).toHaveBeenCalledTimes(1);
      });

      it('removes the shown result', async () => {
        const h = await ready();
        await runAndShowResult(h);
        clickUpdate(h);

        await closeDialog(h, { outcome: 'not-found' });

        expect(resultEl(h)).toBeNull();
      });

      it('cancels a run in flight so its late response is never shown', async () => {
        const h = await ready();
        clickRun(h);
        clickUpdate(h);

        await closeDialog(h, { outcome: 'not-found' });
        h.runs[0].next(makeResult());
        h.runs[0].complete();
        await h.fixture.whenStable();
        h.fixture.detectChanges();

        expect(h.runs[0].observed).toBe(false);
        expect(h.fixture.componentInstance.executing()).toBe(false);
        expect(resultEl(h)).toBeNull();
      });

      it('shows the empty-list state when the last report is gone', async () => {
        const h = await ready([reports[0]]);
        clickUpdate(h);

        await closeDialog(h, { outcome: 'not-found' });

        expect(text(byTestId(h.el, 'saved-reports-empty'))).toContain('No hay reportes guardados.');
        expect(byTestId(h.el, 'saved-reports-select')).toBeNull();
      });

      it('moves focus to the dropdown when other reports remain', async () => {
        const h = await ready();
        clickUpdate(h);

        await closeDialog(h, { outcome: 'not-found' });

        expect(document.activeElement).toBe(byTestId(h.el, 'saved-reports-select'));
      });
    });
  });

  describe('execute a saved report', () => {
    async function ready(): Promise<Harness> {
      const h = setup();
      load(h);
      await selectOption(h, 0);
      return h;
    }

    async function settleView(h: Harness): Promise<void> {
      await h.fixture.whenStable();
      h.fixture.detectChanges();
    }

    const resultEl = (h: Harness): HTMLElement | null => byTestId(h.el, 'saved-report-result');

    describe('request', () => {
      it('sends nothing before the click or on selection', async () => {
        const h = await ready();

        expect(h.execute).not.toHaveBeenCalled();
      });

      it('runs the selected report exactly once when "Ejecutar" is clicked', async () => {
        const h = await ready();

        clickRun(h);

        expect(h.execute).toHaveBeenCalledTimes(1);
        expect(h.execute).toHaveBeenCalledWith(11);
      });

      it('runs the report that is currently selected', async () => {
        const h = await ready();
        await selectOption(h, 1);

        clickRun(h);

        expect(h.execute).toHaveBeenCalledWith(4);
      });

      it('sends a new request on every click once the previous run ended and replaces the result', async () => {
        const h = await ready();

        clickRun(h);
        succeedRun(h, 0, makeResult({ rows: [['Ana', '2024-01-05']], rowCount: 1 }));
        clickRun(h);
        succeedRun(h, 1, makeResult({ rows: [['Zoe', '2024-05-05']], rowCount: 1 }));
        await settleView(h);

        expect(h.execute).toHaveBeenCalledTimes(2);
        expect(text(resultEl(h)?.querySelector('td[mat-cell]') as HTMLElement | null)).toBe('Zoe');
      });
    });

    describe('running state', () => {
      it('disables "Ejecutar" and shows an inline spinner next to "Ejecutando…" while pending', async () => {
        const h = await ready();

        clickRun(h);

        const button = byTestId(h.el, 'saved-report-run-btn') as HTMLButtonElement;
        expect(button.disabled).toBe(true);
        expect(text(button)).toBe('Ejecutando…');
        const spinner = button.querySelector('mat-progress-spinner') as HTMLElement;
        expect(spinner).not.toBeNull();
        expect(spinner.getAttribute('aria-hidden')).toBe('true');
      });

      it('does not send a second request while the first is pending', async () => {
        const h = await ready();

        clickRun(h);
        (byTestId(h.el, 'saved-report-run-btn') as HTMLButtonElement).click();
        h.fixture.componentInstance.onRun();
        h.fixture.detectChanges();

        expect(h.execute).toHaveBeenCalledTimes(1);
      });

      it('keeps "Actualizar" and "Borrar" enabled and unchanged while running', async () => {
        const h = await ready();

        clickRun(h);

        for (const [label, id] of [
          ['Actualizar', 'saved-report-update-btn'],
          ['Borrar', 'saved-report-delete-btn']
        ]) {
          const button = byTestId(h.el, id) as HTMLButtonElement;
          expect(button.disabled).toBe(false);
          expect(text(button)).toBe(label);
          expect(button.querySelector('mat-progress-spinner')).toBeNull();
        }
      });

      it.each([
        ['succeeds', (h: Harness) => succeedRun(h, 0)],
        ['fails', (h: Harness) => failRun(h, 0, 500)]
      ])('restores the normal "Ejecutar" button when the run %s', async (_label, finish) => {
        const h = await ready();
        clickRun(h);

        finish(h);

        const button = byTestId(h.el, 'saved-report-run-btn') as HTMLButtonElement;
        expect(button.disabled).toBe(false);
        expect(text(button)).toBe('Ejecutar');
        expect(button.querySelector('mat-progress-spinner')).toBeNull();
      });
    });

    describe('result', () => {
      it('shows no result before the first run', async () => {
        const h = await ready();

        expect(resultEl(h)).toBeNull();
      });

      it('renders the result view below the card, outside it, with the columns and rows', async () => {
        const h = await ready();
        clickRun(h);

        succeedRun(h, 0);
        await settleView(h);

        const result = resultEl(h) as HTMLElement;
        const card = byTestId(h.el, 'saved-report-card') as HTMLElement;
        expect(result).not.toBeNull();
        expect(result.tagName.toLowerCase()).toBe('app-report-result');
        expect(card.contains(result)).toBe(false);
        expect(Boolean(card.compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
        expect(Array.from(result.querySelectorAll('th[mat-header-cell]')).map((th) => text(th as HTMLElement))).toEqual([
          'Nombre',
          'Inicio'
        ]);
        expect(result.querySelectorAll('tr[mat-row]')).toHaveLength(3);
      });

      it('keeps the dropdown and the report details when the result appears', async () => {
        const h = await ready();
        clickRun(h);

        succeedRun(h, 0);
        await settleView(h);

        expect(text(byTestId(h.el, 'saved-report-name'))).toBe('Zeta alumnos');
        expect(text(byTestId(h.el, 'saved-report-description'))).toBe('Ciclo actual');
        expect(byTestId(h.el, 'saved-reports-select')).not.toBeNull();
        expect(text(byTestId(h.el, 'saved-report-run-btn'))).toBe('Ejecutar');
      });

      it('offers the filter, the paginator, the row count and the export button', async () => {
        const h = await ready();
        clickRun(h);

        succeedRun(h, 0);
        await settleView(h);

        const result = resultEl(h) as HTMLElement;
        expect(result.querySelector('[data-testid="report-filter"]')).not.toBeNull();
        expect(result.querySelector('mat-paginator')).not.toBeNull();
        expect(result.querySelector('[data-testid="report-export-btn"]')).not.toBeNull();
        expect(text(result.querySelector('[data-testid="report-row-count"]') as HTMLElement)).toBe('3 filas');
      });

      it('never offers "Guardar reporte", because a saved report has no save token', async () => {
        const h = await ready();
        clickRun(h);

        succeedRun(h, 0);
        await settleView(h);

        expect(h.el.querySelector('[data-testid="report-save-btn"]')).toBeNull();
        expect(h.el.textContent).not.toContain('Guardar reporte');
      });

      it.each([
        ['a non-blank', 'Ciclo actual'],
        ['a null', null]
      ])('never shows the interpretation line with %s interpretation', async (_label, interpretation) => {
        const h = await ready();
        clickRun(h);

        succeedRun(h, 0, makeResult({ interpretation }));
        await settleView(h);

        expect(h.el.querySelector('[data-testid="report-interpretation"]')).toBeNull();
        expect(h.el.textContent).not.toContain('Se interpretó como');
      });

      it('shows the empty message and no export button when the report has no rows', async () => {
        const h = await ready();
        clickRun(h);

        succeedRun(h, 0, makeResult({ rows: [], rowCount: 0 }));
        await settleView(h);

        const result = resultEl(h) as HTMLElement;
        expect(text(result.querySelector('[data-testid="report-empty"]') as HTMLElement)).toContain(
          'El reporte no devolvió resultados.'
        );
        expect(result.querySelector('[data-testid="report-export-btn"]')).toBeNull();
      });

      it('never shows SQL even if the response carried an extra sql field', async () => {
        const h = await ready();
        clickRun(h);

        succeedRun(h, 0, { ...makeResult(), sql: 'SELECT * FROM student' } as unknown as ReportResult);
        await settleView(h);

        expect(h.el.textContent).not.toContain('SELECT');
      });
    });

    describe('Excel export', () => {
      it('exports the filtered rows with the table headers', async () => {
        const h = await ready();
        clickRun(h);
        succeedRun(h, 0);
        await settleView(h);

        const filter = h.el.querySelector('[data-testid="report-filter"]') as HTMLInputElement;
        filter.value = 'an';
        filter.dispatchEvent(new Event('input'));
        h.fixture.detectChanges();
        h.fixture.detectChanges();
        (h.el.querySelector('[data-testid="export-to-excel-btn"]') as HTMLButtonElement).click();
        await h.fixture.whenStable();

        expect(h.exportToExcel).toHaveBeenCalledTimes(1);
        const config = h.exportToExcel.mock.calls[0][0];
        expect(config.entitySlug).toBe('reporte');
        expect(config.columns.map((c: { header: string }) => c.header)).toEqual(['Nombre', 'Inicio']);
        expect(config.rows).toHaveLength(1);
        expect(config.columns.map((c: { value: (row: unknown) => unknown }) => c.value(config.rows[0]))).toEqual([
          'Ana',
          new Date(Date.UTC(2024, 0, 5))
        ]);
      });
    });

    describe('ownership of the result', () => {
      it('removes the result when another report is selected', async () => {
        const h = await ready();
        clickRun(h);
        succeedRun(h, 0);
        await settleView(h);
        expect(resultEl(h)).not.toBeNull();

        await selectOption(h, 1);

        expect(resultEl(h)).toBeNull();
      });

      it('cancels the pending request and enables "Ejecutar" for the newly selected report', async () => {
        const h = await ready();
        clickRun(h);
        expect(h.runs[0].observed).toBe(true);

        await selectOption(h, 1);

        expect(h.runs[0].observed).toBe(false);
        const button = byTestId(h.el, 'saved-report-run-btn') as HTMLButtonElement;
        expect(button.disabled).toBe(false);
        expect(text(button)).toBe('Ejecutar');
      });

      it('never renders a response that would arrive after the selection changed', async () => {
        const h = await ready();
        clickRun(h);
        await selectOption(h, 1);

        succeedRun(h, 0);
        await settleView(h);

        expect(resultEl(h)).toBeNull();
        expect(text(byTestId(h.el, 'saved-report-name'))).toBe('Alfa maestros');
      });

      it('runs the newly selected report after changing the selection during a run', async () => {
        const h = await ready();
        clickRun(h);
        await selectOption(h, 1);

        clickRun(h);

        expect(h.execute).toHaveBeenCalledTimes(2);
        expect(h.execute).toHaveBeenLastCalledWith(4);
      });

      it('keeps the result when the already selected report is selected again', async () => {
        const h = await ready();
        clickRun(h);
        succeedRun(h, 0);
        await settleView(h);

        h.fixture.componentInstance.onSelect(11);
        h.fixture.detectChanges();

        expect(resultEl(h)).not.toBeNull();
      });
    });

    describe('failures', () => {
      it.each([
        ['404', 404, null, NOT_FOUND_MESSAGE],
        ['422 REPORT_EXECUTION_FAILED', 422, { code: 'REPORT_EXECUTION_FAILED' }, EXECUTION_FAILED_MESSAGE],
        ['422 with another code', 422, { code: 'OTHER' }, RUN_FAILED_MESSAGE],
        ['400', 400, { code: 'BAD_REQUEST' }, RUN_FAILED_MESSAGE],
        ['500', 500, null, RUN_FAILED_MESSAGE],
        ['a network error', 0, null, RUN_FAILED_MESSAGE]
      ])('shows one error snackbar for %s', async (_label, status, body, message) => {
        const h = await ready();
        clickRun(h);

        failRun(h, 0, status, body);

        expect(h.snackOpen).toHaveBeenCalledTimes(1);
        expect(h.snackOpen).toHaveBeenCalledWith(
          message,
          'Cerrar',
          expect.objectContaining({ duration: 5000, panelClass: 'snackbar-error' })
        );
        expect(resultEl(h)).toBeNull();
      });

      it.each([401, 403])('shows no snackbar of its own for %i', async (status) => {
        const h = await ready();
        clickRun(h);

        failRun(h, 0, status);

        expect(h.snackOpen).not.toHaveBeenCalled();
        expect((byTestId(h.el, 'saved-report-run-btn') as HTMLButtonElement).disabled).toBe(false);
      });

      it('keeps "Ejecutar" usable after a failure', async () => {
        const h = await ready();
        clickRun(h);
        failRun(h, 0, 500);

        clickRun(h);

        expect(h.execute).toHaveBeenCalledTimes(2);
      });

      it('never shows the server message', async () => {
        const h = await ready();
        clickRun(h);

        failRun(h, 0, 422, { code: 'REPORT_EXECUTION_FAILED', message: 'column secret_col not found' });

        expect(h.el.textContent).not.toContain('secret_col');
        expect(JSON.stringify(h.snackOpen.mock.calls)).not.toContain('secret_col');
      });

      it('logs only the status, never the response body', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const h = await ready();
        clickRun(h);

        failRun(h, 0, 422, {
          code: 'REPORT_EXECUTION_FAILED',
          message: 'column secret_col not found',
          sql: 'select 1'
        });

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith('[SavedReports] failed to run saved report', 422);
      });

      it('keeps the previous result of the same report after a failed run', async () => {
        const h = await ready();
        clickRun(h);
        succeedRun(h, 0);
        await settleView(h);

        clickRun(h);
        failRun(h, 1, 500);
        await settleView(h);

        expect(resultEl(h)).not.toBeNull();
        expect(resultEl(h)?.querySelectorAll('tr[mat-row]')).toHaveLength(3);
        expect(h.snackOpen).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('empty list', () => {
    it('shows the empty state and no select', () => {
      const h = setup();
      load(h, []);

      const empty = byTestId(h.el, 'saved-reports-empty') as HTMLElement;
      expect(empty).not.toBeNull();
      expect(text(empty)).toContain('No hay reportes guardados.');
      expect(empty.querySelector('mat-icon')).not.toBeNull();
      expect(byTestId(h.el, 'saved-reports-select')).toBeNull();
    });
  });

  describe('failures', () => {
    it.each([
      ['a 500 response', 500],
      ['a network error', 0]
    ])('shows one error snackbar and no select after %s', (_label, status) => {
      const h = setup();
      fail(h, status);

      expect(h.snackOpen).toHaveBeenCalledTimes(1);
      expect(h.snackOpen).toHaveBeenCalledWith(
        LOAD_FAILED_MESSAGE,
        'Cerrar',
        expect.objectContaining({ panelClass: 'snackbar-error' })
      );
      expect(byTestId(h.el, 'saved-reports-select')).toBeNull();
      expect(byTestId(h.el, 'saved-reports-empty')).toBeNull();
    });

    it('never shows the server message', () => {
      const h = setup();
      fail(h, 500, { message: 'could not connect to database xyz' });

      expect(h.el.textContent).not.toContain('database xyz');
      expect(JSON.stringify(h.snackOpen.mock.calls)).not.toContain('database xyz');
    });

    it.each([401, 403])('shows no snackbar and no select after a %i response', (status) => {
      const h = setup();
      fail(h, status);

      expect(h.snackOpen).not.toHaveBeenCalled();
      expect(byTestId(h.el, 'saved-reports-select')).toBeNull();
      expect(byTestId(h.el, 'saved-reports-loading')).toBeNull();
    });

    it('logs only the status, never the response body', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const h = setup();
      fail(h, 500, { message: 'could not connect to database xyz', sql: 'select 1' });

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith('[SavedReports] failed to load saved reports', 500);
    });
  });
});
