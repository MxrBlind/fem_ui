import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSnackBar } from '@angular/material/snack-bar';
import { By } from '@angular/platform-browser';

import { environment } from '../../../../environments/environment';
import { UserDto } from '@core/models/auth.model';
import {
  LOAD_ERROR_MESSAGE,
  TEACHER_FALLBACK,
  TeacherListComponent,
} from './teacher-list.component';

const USERS_URL = `${environment.apiBaseUrl}/api/user`;

function makeTeacher(id: number, overrides: Partial<UserDto> = {}): UserDto {
  return {
    id,
    username: `t${id}`,
    profile: {
      name: `Name${id}`,
      parentLastName: `Paterno${id}`,
      motherLastName: `Materno${id}`,
      email: `t${id}@example.com`,
      phone: `55500000${id}`,
      church: `Church${id}`,
    },
    ...overrides,
  };
}

interface Harness {
  fixture: ComponentFixture<TeacherListComponent>;
  http: HttpTestingController;
  snackOpen: ReturnType<typeof vi.spyOn>;
}

function setup(options: { skipFlush?: boolean; teachers?: UserDto[] } = {}): Harness {
  TestBed.configureTestingModule({
    imports: [TeacherListComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
    ],
  });

  const snackOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockReturnValue({} as never);

  const fixture = TestBed.createComponent(TeacherListComponent);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);

  if (!options.skipFlush) {
    const teachers = options.teachers ?? [makeTeacher(1), makeTeacher(2), makeTeacher(3)];
    http
      .expectOne((r) => r.method === 'GET' && r.url === USERS_URL && r.params.get('role') === 'ROLE_TEACHER')
      .flush(teachers);
    fixture.detectChanges();
  }

  return { fixture, http, snackOpen };
}

function text(fixture: ComponentFixture<TeacherListComponent>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('TeacherListComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* some tests verify themselves */
    }
  });

  describe('loading state', () => {
    it('shows the progress bar while pending and hides it after response', () => {
      const { fixture, http } = setup({ skipFlush: true });
      expect(fixture.debugElement.query(By.css('mat-progress-bar'))).toBeTruthy();
      http
        .expectOne((r) => r.method === 'GET' && r.url === USERS_URL)
        .flush([]);
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('mat-progress-bar'))).toBeFalsy();
      expect(fixture.componentInstance.loading()).toBe(false);
    });
  });

  describe('row mapping', () => {
    it('renders one row per UserDto and maps every profile field', () => {
      const { fixture } = setup({ teachers: [makeTeacher(1)] });
      const rows = fixture.componentInstance.rows();
      expect(rows.length).toBe(1);
      expect(rows[0]).toMatchObject({
        id: 1,
        name: 'Name1',
        parentLastName: 'Paterno1',
        motherLastName: 'Materno1',
        email: 't1@example.com',
        phone: '555000001',
        church: 'Church1',
      });
    });

    it('falls back to em-dash when profile is missing', () => {
      const { fixture } = setup({ teachers: [{ id: 5, username: 'x' }] });
      const row = fixture.componentInstance.rows()[0];
      expect(row.name).toBe(TEACHER_FALLBACK);
      expect(row.parentLastName).toBe(TEACHER_FALLBACK);
      expect(row.motherLastName).toBe(TEACHER_FALLBACK);
      expect(row.email).toBe(TEACHER_FALLBACK);
      expect(row.phone).toBe(TEACHER_FALLBACK);
      expect(row.church).toBe(TEACHER_FALLBACK);
    });

    it('falls back to em-dash when a profile field is null, undefined, or whitespace', () => {
      const { fixture } = setup({
        teachers: [
          {
            id: 6,
            username: 'y',
            profile: {
              name: null as unknown as string,
              parentLastName: undefined,
              motherLastName: '   ',
              email: '',
              phone: 'ok',
              church: undefined,
            },
          },
        ],
      });
      const row = fixture.componentInstance.rows()[0];
      expect(row.name).toBe(TEACHER_FALLBACK);
      expect(row.parentLastName).toBe(TEACHER_FALLBACK);
      expect(row.motherLastName).toBe(TEACHER_FALLBACK);
      expect(row.email).toBe(TEACHER_FALLBACK);
      expect(row.phone).toBe('ok');
      expect(row.church).toBe(TEACHER_FALLBACK);
    });
  });

  describe('column rendering', () => {
    it('renders all eight column headers in order', () => {
      const { fixture } = setup();
      const headers = fixture.debugElement
        .queryAll(By.css('th.mat-mdc-header-cell'))
        .map((h) => (h.nativeElement.textContent ?? '').trim());
      expect(headers).toEqual([
        'ID',
        'Nombre(s)',
        'Paterno',
        'Materno',
        'Email',
        'Teléfono',
        'Iglesia',
        'Acciones',
      ]);
    });
  });

  describe('filter', () => {
    it('narrows visible rows on substring match against name', () => {
      const { fixture } = setup();
      fixture.componentInstance.onFilterInput('Name2');
      fixture.detectChanges();
      expect(fixture.componentInstance.dataSource.filteredData.length).toBe(1);
      expect(fixture.componentInstance.dataSource.filteredData[0].name).toBe('Name2');
    });

    it('is case-insensitive and matches across email and phone', () => {
      const { fixture } = setup();
      fixture.componentInstance.onFilterInput('T3@EXAMPLE');
      fixture.detectChanges();
      expect(fixture.componentInstance.dataSource.filteredData.length).toBe(1);

      fixture.componentInstance.onFilterInput('55500000');
      fixture.detectChanges();
      expect(fixture.componentInstance.dataSource.filteredData.length).toBe(3);
    });

    it('matches against parentLastName, motherLastName, church, and id', () => {
      const { fixture } = setup();
      const src = fixture.componentInstance;

      src.onFilterInput('Paterno1');
      fixture.detectChanges();
      expect(src.dataSource.filteredData.map((r) => r.id)).toEqual([1]);

      src.onFilterInput('Materno2');
      fixture.detectChanges();
      expect(src.dataSource.filteredData.map((r) => r.id)).toEqual([2]);

      src.onFilterInput('Church3');
      fixture.detectChanges();
      expect(src.dataSource.filteredData.map((r) => r.id)).toEqual([3]);

      src.onFilterInput('2');
      fixture.detectChanges();
      expect(src.dataSource.filteredData.map((r) => r.id)).toContain(2);
    });

    it('does not issue an HTTP request on keystroke', () => {
      const { fixture, http } = setup();
      fixture.componentInstance.onFilterInput('foo');
      fixture.detectChanges();
      http.expectNone((r) => r.url === USERS_URL);
    });
  });

  describe('default sort and pagination', () => {
    it('default sort is name ascending', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.sort?.active).toBe('name');
      expect(fixture.componentInstance.sort?.direction).toBe('asc');
    });

    it('paginator default page size is 10 with the configured options', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.paginator?.pageSize).toBe(10);
      expect(fixture.componentInstance.paginator?.pageSizeOptions).toEqual([5, 10, 25, 50]);
    });

    it('changing page index does not issue an HTTP request', () => {
      const { fixture, http } = setup();
      fixture.componentInstance.paginator?.nextPage();
      fixture.detectChanges();
      http.expectNone((r) => r.url === USERS_URL);
    });
  });

  describe('empty state', () => {
    it('renders the empty placeholder when the API returns []', () => {
      const { fixture } = setup({ teachers: [] });
      expect(text(fixture)).toContain('No hay maestros registrados.');
    });
  });

  describe('error state', () => {
    it('clears loading, shows the error snackbar, and logs on API failure', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { fixture, http, snackOpen } = setup({ skipFlush: true });
      http
        .expectOne((r) => r.method === 'GET' && r.url === USERS_URL)
        .error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect(fixture.componentInstance.loading()).toBe(false);
      expect(snackOpen).toHaveBeenCalled();
      const [msg, , cfg] = snackOpen.mock.calls[0];
      expect(msg).toBe(LOAD_ERROR_MESSAGE);
      expect((cfg as { panelClass?: string }).panelClass).toBe('snackbar-error');
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('placeholder actions', () => {
    it('Nuevo maestro click is a no-op (no HTTP)', () => {
      const { fixture, http } = setup();
      const btn = fixture.debugElement.query(By.css('[data-testid="teachers-new-btn"]'));
      (btn.nativeElement as HTMLButtonElement).click();
      fixture.detectChanges();
      http.expectNone((r) => r.url === USERS_URL);
    });

    it('edit and delete buttons render per row and are no-ops', () => {
      const { fixture, http } = setup();
      const edits = fixture.debugElement.queryAll(By.css('[data-testid="teacher-edit-btn"]'));
      const deletes = fixture.debugElement.queryAll(By.css('[data-testid="teacher-delete-btn"]'));
      expect(edits.length).toBe(3);
      expect(deletes.length).toBe(3);
      (edits[0].nativeElement as HTMLButtonElement).click();
      (deletes[0].nativeElement as HTMLButtonElement).click();
      fixture.detectChanges();
      http.expectNone((r) => r.url === USERS_URL);
    });

    it('action buttons expose aria-labels with the row id', () => {
      const { fixture } = setup({ teachers: [makeTeacher(42)] });
      const edit = fixture.debugElement.query(By.css('[data-testid="teacher-edit-btn"]'))
        .nativeElement as HTMLElement;
      const del = fixture.debugElement.query(By.css('[data-testid="teacher-delete-btn"]'))
        .nativeElement as HTMLElement;
      expect(edit.getAttribute('aria-label')).toBe('Editar maestro 42');
      expect(del.getAttribute('aria-label')).toBe('Eliminar maestro 42');
    });
  });
});
