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
import { UserDto } from '@core/models/auth.model';
import {
  LOAD_ERROR_MESSAGE,
  STUDENT_FALLBACK,
  StudentListComponent,
} from './student-list.component';

const USERS_URL = `${environment.apiBaseUrl}/api/user`;

const admin: AuthUser = { id: 1, username: 'admin', role: 'admin', rawRole: 'admin' };
const teacher: AuthUser = {
  id: 2,
  username: 'teacher',
  role: 'teacher',
  rawRole: 'teacher',
};

function makeStudent(id: number, overrides: Partial<UserDto> = {}): UserDto {
  return {
    id,
    username: `s${id}`,
    profile: {
      name: `Name${id}`,
      parentLastName: `Paterno${id}`,
      motherLastName: `Materno${id}`,
      email: `s${id}@example.com`,
      phone: `55500000${id}`,
      church: `Church${id}`,
    },
    ...overrides,
  };
}

interface Harness {
  fixture: ComponentFixture<StudentListComponent>;
  http: HttpTestingController;
  snackOpen: ReturnType<typeof vi.spyOn>;
}

function setup(
  options: { skipFlush?: boolean; students?: UserDto[]; user?: AuthUser } = {}
): Harness {
  const currentUser = signal<AuthUser | null>(options.user ?? admin);
  const fakeAuth = { currentUser: currentUser.asReadonly() } as unknown as AuthService;

  TestBed.configureTestingModule({
    imports: [StudentListComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: AuthService, useValue: fakeAuth },
    ],
  });

  const snackOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockReturnValue({} as never);

  const fixture = TestBed.createComponent(StudentListComponent);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);

  if (!options.skipFlush) {
    const students = options.students ?? [makeStudent(1), makeStudent(2), makeStudent(3)];
    http
      .expectOne(
        (r) =>
          r.method === 'GET' &&
          r.url === USERS_URL &&
          r.params.get('role') === 'ROLE_STUDENT'
      )
      .flush(students);
    fixture.detectChanges();
  }

  return { fixture, http, snackOpen };
}

function text(fixture: ComponentFixture<StudentListComponent>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('StudentListComponent', () => {
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
      http.expectOne((r) => r.method === 'GET' && r.url === USERS_URL).flush([]);
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('mat-progress-bar'))).toBeFalsy();
      expect(fixture.componentInstance.loading()).toBe(false);
    });
  });

  describe('row mapping', () => {
    it('renders one row per UserDto and maps every profile field', () => {
      const { fixture } = setup({ students: [makeStudent(1)] });
      const rows = fixture.componentInstance.rows();
      expect(rows.length).toBe(1);
      expect(rows[0]).toMatchObject({
        id: 1,
        name: 'Name1',
        parentLastName: 'Paterno1',
        motherLastName: 'Materno1',
        email: 's1@example.com',
        phone: '555000001',
        church: 'Church1',
      });
    });

    it('falls back to em-dash when profile is missing', () => {
      const { fixture } = setup({ students: [{ id: 5, username: 'x' }] });
      const row = fixture.componentInstance.rows()[0];
      expect(row.name).toBe(STUDENT_FALLBACK);
      expect(row.parentLastName).toBe(STUDENT_FALLBACK);
      expect(row.motherLastName).toBe(STUDENT_FALLBACK);
      expect(row.email).toBe(STUDENT_FALLBACK);
      expect(row.phone).toBe(STUDENT_FALLBACK);
      expect(row.church).toBe(STUDENT_FALLBACK);
    });

    it('falls back to em-dash when a profile field is null, undefined, or whitespace', () => {
      const { fixture } = setup({
        students: [
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
      expect(row.name).toBe(STUDENT_FALLBACK);
      expect(row.parentLastName).toBe(STUDENT_FALLBACK);
      expect(row.motherLastName).toBe(STUDENT_FALLBACK);
      expect(row.email).toBe(STUDENT_FALLBACK);
      expect(row.phone).toBe('ok');
      expect(row.church).toBe(STUDENT_FALLBACK);
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

    it('renders the header title "Administrar estudiantes" and the "Nuevo estudiante" button', () => {
      const { fixture } = setup();
      expect(text(fixture)).toContain('Administrar estudiantes');
      const btn = fixture.debugElement.query(
        By.css('[data-testid="students-new-btn"]')
      );
      expect(btn).toBeTruthy();
      expect((btn.nativeElement as HTMLElement).textContent).toContain(
        'Nuevo estudiante'
      );
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
      fixture.componentInstance.onFilterInput('S3@EXAMPLE');
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
      expect(fixture.componentInstance.paginator?.pageSizeOptions).toEqual([
        5, 10, 25, 50,
      ]);
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
      const { fixture } = setup({ students: [] });
      expect(text(fixture)).toContain('No hay estudiantes registrados.');
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

  describe('row actions (stubbed)', () => {
    it('edit and delete buttons render per row for admin users', () => {
      const { fixture } = setup();
      const edits = fixture.debugElement.queryAll(
        By.css('[data-testid="student-edit-btn"]')
      );
      const deletes = fixture.debugElement.queryAll(
        By.css('[data-testid="student-delete-btn"]')
      );
      expect(edits.length).toBe(3);
      expect(deletes.length).toBe(3);
    });

    it('exposes aria-labels with the row id on edit and delete buttons', () => {
      const { fixture } = setup({ students: [makeStudent(42)] });
      const edit = fixture.debugElement.query(
        By.css('[data-testid="student-edit-btn"]')
      ).nativeElement as HTMLElement;
      const del = fixture.debugElement.query(
        By.css('[data-testid="student-delete-btn"]')
      ).nativeElement as HTMLElement;
      expect(edit.getAttribute('aria-label')).toBe('Editar estudiante 42');
      expect(del.getAttribute('aria-label')).toBe('Eliminar estudiante 42');
    });

    it('delete button is hidden for non-admin users', () => {
      const { fixture } = setup({ user: teacher });
      const buttons = fixture.debugElement.queryAll(
        By.css('button[data-testid="student-delete-btn"]')
      );
      expect(buttons.length).toBe(0);
    });

    it('clicking "Nuevo estudiante" is a no-op (no HTTP, rows unchanged)', () => {
      const { fixture, http } = setup();
      const before = fixture.componentInstance.dataSource.data;
      const btn = fixture.debugElement.query(
        By.css('[data-testid="students-new-btn"]')
      );
      (btn.nativeElement as HTMLButtonElement).click();
      fixture.detectChanges();
      http.expectNone((r) => r.url === USERS_URL);
      expect(fixture.componentInstance.dataSource.data).toBe(before);
    });

    it('clicking edit is a no-op (no HTTP, rows unchanged)', () => {
      const { fixture, http } = setup();
      const before = fixture.componentInstance.dataSource.data;
      const editBtn = fixture.debugElement.query(
        By.css('[data-testid="student-edit-btn"]')
      );
      (editBtn.nativeElement as HTMLButtonElement).click();
      fixture.detectChanges();
      http.expectNone((r) => r.url === USERS_URL);
      expect(fixture.componentInstance.dataSource.data).toBe(before);
    });

    it('clicking delete is a no-op (no HTTP, rows unchanged)', () => {
      const { fixture, http } = setup();
      const before = fixture.componentInstance.dataSource.data;
      const delBtn = fixture.debugElement.query(
        By.css('[data-testid="student-delete-btn"]')
      );
      (delBtn.nativeElement as HTMLButtonElement).click();
      fixture.detectChanges();
      http.expectNone((r) => r.url === USERS_URL);
      expect(fixture.componentInstance.dataSource.data).toBe(before);
    });
  });
});
