import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';

import { ReportService } from '@core/services/report.service';
import { SavedReport } from '../models/report.model';
import { SavedReportsComponent } from './saved-reports.component';

const LOAD_FAILED_MESSAGE = 'No se pudieron cargar los reportes guardados.';

const reports: SavedReport[] = [
  {
    id: 11,
    name: 'Zeta alumnos',
    description: 'Ciclo actual',
    originalPrompt: 'prompt secreto uno',
    createdDate: '2026-11-22T01:00:00',
    lastRunDate: '2026-11-23T08:15:00'
  },
  {
    id: 4,
    name: 'Alfa maestros',
    description: null,
    originalPrompt: 'prompt secreto dos',
    createdDate: '2026-11-20T10:00:00',
    lastRunDate: null
  },
  {
    id: 7,
    name: 'Beta materias',
    description: '',
    originalPrompt: 'prompt secreto tres',
    createdDate: '2026-11-21T10:00:00',
    lastRunDate: null
  }
];

interface Harness {
  fixture: ComponentFixture<SavedReportsComponent>;
  el: HTMLElement;
  listSaved: ReturnType<typeof vi.fn>;
  snackOpen: ReturnType<typeof vi.spyOn>;
  dialogOpen: ReturnType<typeof vi.spyOn>;
  navigate: ReturnType<typeof vi.spyOn>;
  navigateByUrl: ReturnType<typeof vi.spyOn>;
  /** Controls the request issued by the page on init. */
  request: Subject<SavedReport[]>;
}

function setup(): Harness {
  const request = new Subject<SavedReport[]>();
  const listSaved = vi.fn(() => request.asObservable());

  TestBed.configureTestingModule({
    imports: [SavedReportsComponent],
    providers: [provideAnimationsAsync(), provideRouter([]), { provide: ReportService, useValue: { listSaved } }]
  });
  const snackOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockReturnValue({} as never);
  const dialogOpen = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue({} as never);
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
    navigate,
    navigateByUrl,
    request
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

  describe('placeholder action buttons', () => {
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

    it.each(buttonIds)('does nothing when "%s" is clicked', async (_label, id) => {
      const h = setup();
      load(h);
      await selectOption(h, 0);
      const before = h.el.innerHTML;

      (byTestId(h.el, id) as HTMLButtonElement).click();
      h.fixture.detectChanges();

      expect(h.listSaved).toHaveBeenCalledTimes(1);
      expect(h.dialogOpen).not.toHaveBeenCalled();
      expect(h.navigate).not.toHaveBeenCalled();
      expect(h.navigateByUrl).not.toHaveBeenCalled();
      expect(h.snackOpen).not.toHaveBeenCalled();
      expect(h.el.innerHTML).toBe(before);
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
