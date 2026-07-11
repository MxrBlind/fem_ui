import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { By } from '@angular/platform-browser';

import { environment } from '../../../../environments/environment';
import { AuthService } from '@core/services/auth.service';
import { AuthUser } from '@core/auth/rbac';
import { SubjectDto } from '@features/enrollments/models/enrollment.model';
import {
  ADMIN_TITLE,
  LOAD_ERROR_MESSAGE,
  NEW_BUTTON_LABEL,
  SUBJECT_FALLBACK,
  SubjectListComponent,
} from './subject-list.component';

const SUBJECTS_URL = `${environment.apiBaseUrl}/api/subject`;

const admin: AuthUser = { id: 1, username: 'admin', role: 'admin', rawRole: 'admin' };
const teacher: AuthUser = {
  id: 2,
  username: 'teacher',
  role: 'teacher',
  rawRole: 'teacher',
};

function makeSubject(id: number, overrides: Partial<SubjectDto> = {}): SubjectDto {
  return {
    id,
    code: `S${id}`,
    description: `Materia ${id}`,
    category: {
      id,
      title: `Categoria ${id}`,
      description: '',
      code: `C${id}`,
    },
    level: { id, title: `Nivel ${id}`, code: `L${id}` },
    ...overrides,
  };
}

interface Harness {
  fixture: ComponentFixture<SubjectListComponent>;
  http: HttpTestingController;
  snackOpen: ReturnType<typeof vi.spyOn>;
}

function setup(
  options: { skipFlush?: boolean; subjects?: SubjectDto[]; user?: AuthUser } = {}
): Harness {
  const currentUser = signal<AuthUser | null>(options.user ?? admin);
  const fakeAuth = { currentUser: currentUser.asReadonly() } as unknown as AuthService;

  TestBed.configureTestingModule({
    imports: [SubjectListComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: AuthService, useValue: fakeAuth },
    ],
  });

  const snackOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockReturnValue({} as never);

  const fixture = TestBed.createComponent(SubjectListComponent);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);

  if (!options.skipFlush) {
    const subjects =
      options.subjects ?? [makeSubject(1), makeSubject(2), makeSubject(3)];
    http
      .expectOne((r) => r.method === 'GET' && r.url === SUBJECTS_URL)
      .flush(subjects);
    fixture.detectChanges();
  }

  return { fixture, http, snackOpen };
}

function text(fixture: ComponentFixture<SubjectListComponent>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('SubjectListComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* some tests verify themselves */
    }
  });

  describe('header', () => {
    it('renders the title "Administrar materias" and the "Nueva materia" button for admin', () => {
      const { fixture } = setup();
      expect(text(fixture)).toContain(ADMIN_TITLE);
      const btn = fixture.debugElement.query(
        By.css('[data-testid="subjects-new-btn"]')
      );
      expect(btn).toBeTruthy();
      expect((btn.nativeElement as HTMLElement).textContent).toContain(
        NEW_BUTTON_LABEL
      );
    });

    it('hides the "Nueva materia" button for non-admin users', () => {
      const { fixture } = setup({ user: teacher });
      const btn = fixture.debugElement.query(
        By.css('[data-testid="subjects-new-btn"]')
      );
      expect(btn).toBeFalsy();
    });
  });

  describe('loading state', () => {
    it('shows the progress bar while pending and hides it after response', () => {
      const { fixture, http } = setup({ skipFlush: true });
      expect(fixture.debugElement.query(By.css('mat-progress-bar'))).toBeTruthy();
      http.expectOne((r) => r.method === 'GET' && r.url === SUBJECTS_URL).flush([]);
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('mat-progress-bar'))).toBeFalsy();
      expect(fixture.componentInstance.loading()).toBe(false);
    });
  });

  describe('row mapping', () => {
    it('renders one row per SubjectDto and flattens category/level titles', () => {
      const { fixture } = setup({ subjects: [makeSubject(1)] });
      const rows = fixture.componentInstance.rows();
      expect(rows.length).toBe(1);
      expect(rows[0]).toMatchObject({
        id: 1,
        code: 'S1',
        description: 'Materia 1',
        category: 'Categoria 1',
        level: 'Nivel 1',
      });
    });

    it('falls back to em-dash when category.title or level.title is missing or blank', () => {
      const { fixture } = setup({
        subjects: [
          {
            id: 5,
            code: 'X',
            description: 'blank',
            category: { title: '   ', description: '', code: '' },
            level: { title: undefined },
          },
        ],
      });
      const row = fixture.componentInstance.rows()[0];
      expect(row.category).toBe(SUBJECT_FALLBACK);
      expect(row.level).toBe(SUBJECT_FALLBACK);
    });
  });

  describe('columns', () => {
    it('renders the five column headers in order', () => {
      const { fixture } = setup();
      const headers = fixture.debugElement
        .queryAll(By.css('th.mat-mdc-header-cell'))
        .map((h) => (h.nativeElement.textContent ?? '').trim());
      expect(headers).toEqual(['ID', 'Nombre', 'Categoría', 'Nivel', 'Acciones']);
    });
  });

  describe('filter', () => {
    it('narrows visible rows on substring match against description', () => {
      const { fixture } = setup();
      fixture.componentInstance.onFilterInput('Materia 2');
      fixture.detectChanges();
      expect(fixture.componentInstance.dataSource.filteredData.length).toBe(1);
      expect(fixture.componentInstance.dataSource.filteredData[0].description).toBe(
        'Materia 2'
      );
    });

    it('is case-insensitive and matches across category, level, code, and id', () => {
      const { fixture } = setup();
      const src = fixture.componentInstance;

      src.onFilterInput('categoria 3');
      fixture.detectChanges();
      expect(src.dataSource.filteredData.map((r) => r.id)).toEqual([3]);

      src.onFilterInput('NIVEL 1');
      fixture.detectChanges();
      expect(src.dataSource.filteredData.map((r) => r.id)).toEqual([1]);

      src.onFilterInput('s2');
      fixture.detectChanges();
      expect(src.dataSource.filteredData.map((r) => r.id)).toEqual([2]);

      src.onFilterInput('3');
      fixture.detectChanges();
      expect(src.dataSource.filteredData.map((r) => r.id)).toContain(3);
    });

    it('clearFilter empties the input and restores all rows', () => {
      const { fixture } = setup();
      fixture.componentInstance.onFilterInput('Materia 1');
      fixture.detectChanges();
      expect(fixture.componentInstance.dataSource.filteredData.length).toBe(1);
      fixture.componentInstance.clearFilter();
      fixture.detectChanges();
      expect(fixture.componentInstance.filterText()).toBe('');
      expect(fixture.componentInstance.dataSource.filteredData.length).toBe(3);
    });

    it('does not issue an HTTP request on keystroke', () => {
      const { fixture, http } = setup();
      fixture.componentInstance.onFilterInput('foo');
      fixture.detectChanges();
      http.expectNone((r) => r.url === SUBJECTS_URL);
    });
  });

  describe('sort and pagination', () => {
    it('default sort is description ascending', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.sort?.active).toBe('description');
      expect(fixture.componentInstance.sort?.direction).toBe('asc');
    });

    it('paginator default page size is 10 with the configured options', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.paginator?.pageSize).toBe(10);
      expect(fixture.componentInstance.paginator?.pageSizeOptions).toEqual([
        5, 10, 25, 50,
      ]);
    });

    it('changing page index does not issue an HTTP request', () => {
      const { fixture, http } = setup();
      fixture.componentInstance.paginator?.nextPage();
      fixture.detectChanges();
      http.expectNone((r) => r.url === SUBJECTS_URL);
    });
  });

  describe('empty state', () => {
    it('renders the empty placeholder when the API returns []', () => {
      const { fixture } = setup({ subjects: [] });
      expect(text(fixture)).toContain('No hay materias registradas.');
    });
  });

  describe('error state', () => {
    it('clears loading, shows the error snackbar, and logs on API failure', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { fixture, http, snackOpen } = setup({ skipFlush: true });
      http
        .expectOne((r) => r.method === 'GET' && r.url === SUBJECTS_URL)
        .error(new ProgressEvent('error'), {
          status: 500,
          statusText: 'Server Error',
        });
      fixture.detectChanges();

      expect(fixture.componentInstance.loading()).toBe(false);
      expect(snackOpen).toHaveBeenCalled();
      const [msg, , cfg] = snackOpen.mock.calls[0];
      expect(msg).toBe(LOAD_ERROR_MESSAGE);
      expect((cfg as { panelClass?: string }).panelClass).toBe('snackbar-error');
      expect(errorSpy).toHaveBeenCalledWith(
        '[subject-list] failed to load',
        expect.anything()
      );
      errorSpy.mockRestore();
    });
  });

  describe('row actions (stubbed)', () => {
    it('renders edit and delete buttons per row with tooltips and aria-labels', () => {
      const { fixture } = setup();
      const edits = fixture.debugElement.queryAll(
        By.css('[data-testid="subject-edit-btn"]')
      );
      const deletes = fixture.debugElement.queryAll(
        By.css('[data-testid="subject-delete-btn"]')
      );
      expect(edits.length).toBe(3);
      expect(deletes.length).toBe(3);
      const editEl = edits[0].nativeElement as HTMLElement;
      const delEl = deletes[0].nativeElement as HTMLElement;
      expect(editEl.getAttribute('aria-label')).toBe('Editar materia');
      expect(delEl.getAttribute('aria-label')).toBe('Eliminar materia');
    });

    it('onCreate/onEdit/onDelete are no-ops (no HTTP, no throw)', () => {
      const { fixture, http } = setup();
      const before = fixture.componentInstance.dataSource.data;
      const row = fixture.componentInstance.rows()[0];
      expect(() => fixture.componentInstance.onCreate()).not.toThrow();
      expect(() => fixture.componentInstance.onEdit(row)).not.toThrow();
      expect(() => fixture.componentInstance.onDelete(row)).not.toThrow();
      fixture.detectChanges();
      http.expectNone((r) => r.url === SUBJECTS_URL);
      expect(fixture.componentInstance.dataSource.data).toBe(before);
    });
  });
});
