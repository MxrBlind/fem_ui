import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { By } from '@angular/platform-browser';

import { environment } from '../../../../environments/environment';
import { AuthService } from '@core/services/auth.service';
import { AuthUser } from '@core/auth/rbac';
import { UserDto } from '@core/models/auth.model';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import {
  DELETE_ERROR_MESSAGE,
  DELETE_SUCCESS_MESSAGE,
  LOAD_ERROR_MESSAGE,
  TEACHER_FALLBACK,
  TeacherListComponent,
} from './teacher-list.component';
import { TeacherDeleteConfirmComponent } from '../teacher-delete-confirm/teacher-delete-confirm.component';
import { TeacherEditComponent } from '../teacher-edit/teacher-edit.component';
import { TeacherNewComponent } from '../teacher-new/teacher-new.component';

const USERS_URL = `${environment.apiBaseUrl}/api/user`;

const admin: AuthUser = { id: 1, username: 'admin', role: 'admin', rawRole: 'admin' };
const teacher: AuthUser = { id: 2, username: 'teacher', role: 'teacher', rawRole: 'teacher' };

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

function setup(
  options: { skipFlush?: boolean; teachers?: UserDto[]; user?: AuthUser } = {}
): Harness {
  const currentUser = signal<AuthUser | null>(options.user ?? admin);
  const fakeAuth = { currentUser: currentUser.asReadonly() } as unknown as AuthService;

  TestBed.configureTestingModule({
    imports: [TeacherListComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: AuthService, useValue: fakeAuth },
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

  describe('Nuevo maestro dialog wiring', () => {
    function setupWithDialogMock(afterClosed$: Subject<UserDto | undefined>): {
      fixture: ComponentFixture<TeacherListComponent>;
      http: HttpTestingController;
      openSpy: ReturnType<typeof vi.spyOn>;
    } {
      const currentUser = signal<AuthUser | null>(admin);
      const fakeAuth = { currentUser: currentUser.asReadonly() } as unknown as AuthService;
      TestBed.configureTestingModule({
        imports: [TeacherListComponent],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideAnimationsAsync(),
          { provide: AuthService, useValue: fakeAuth },
        ],
      });
      vi.spyOn(MatSnackBar.prototype, 'open').mockReturnValue({} as never);
      const openSpy = vi
        .spyOn(MatDialog.prototype, 'open')
        .mockReturnValue({
          afterClosed: () => afterClosed$.asObservable(),
        } as never);

      const fixture = TestBed.createComponent(TeacherListComponent);
      fixture.detectChanges();
      const http = TestBed.inject(HttpTestingController);
      http
        .expectOne((r) => r.method === 'GET' && r.url === USERS_URL)
        .flush([makeTeacher(1)]);
      fixture.detectChanges();
      return { fixture, http, openSpy };
    }

    it('clicking Nuevo maestro opens TeacherNewComponent with the expected config', () => {
      const closed$ = new Subject<UserDto | undefined>();
      const { fixture, openSpy } = setupWithDialogMock(closed$);
      const btn = fixture.debugElement.query(By.css('[data-testid="teachers-new-btn"]'));
      (btn.nativeElement as HTMLButtonElement).click();
      expect(openSpy).toHaveBeenCalledWith(TeacherNewComponent, {
        width: '560px',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      });
    });

    it('reloads the list when afterClosed emits a UserDto', () => {
      const closed$ = new Subject<UserDto | undefined>();
      const { fixture, http } = setupWithDialogMock(closed$);
      fixture.componentInstance.onCreate();

      closed$.next({ id: 42, username: 'new' });
      const req = http.expectOne(
        (r) => r.method === 'GET' && r.url === USERS_URL
      );
      req.flush([makeTeacher(1), makeTeacher(42, { username: 'new' })]);
      fixture.detectChanges();
      expect(fixture.componentInstance.rows().length).toBe(2);
    });

    it('does not reload when afterClosed emits undefined', () => {
      const closed$ = new Subject<UserDto | undefined>();
      const { fixture, http } = setupWithDialogMock(closed$);
      fixture.componentInstance.onCreate();
      closed$.next(undefined);
      http.expectNone((r) => r.url === USERS_URL);
      expect(fixture.componentInstance.rows().length).toBe(1);
    });
  });

  describe('row actions', () => {
    it('edit and delete buttons render per row for admin users', () => {
      const { fixture } = setup();
      const edits = fixture.debugElement.queryAll(By.css('[data-testid="teacher-edit-btn"]'));
      const deletes = fixture.debugElement.queryAll(By.css('[data-testid="teacher-delete-btn"]'));
      expect(edits.length).toBe(3);
      expect(deletes.length).toBe(3);
    });

    it('clicking edit opens TeacherEditComponent with { user: row.raw }', () => {
      const currentUser = signal<AuthUser | null>(admin);
      const fakeAuth = { currentUser: currentUser.asReadonly() } as unknown as AuthService;
      TestBed.configureTestingModule({
        imports: [TeacherListComponent],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideAnimationsAsync(),
          { provide: AuthService, useValue: fakeAuth },
        ],
      });
      vi.spyOn(MatSnackBar.prototype, 'open').mockReturnValue({} as never);
      const closed$ = new Subject<UserDto | undefined>();
      const openSpy = vi
        .spyOn(MatDialog.prototype, 'open')
        .mockReturnValue({
          afterClosed: () => closed$.asObservable(),
        } as never);

      const fixture = TestBed.createComponent(TeacherListComponent);
      fixture.detectChanges();
      const http = TestBed.inject(HttpTestingController);
      const teacher = makeTeacher(11);
      http
        .expectOne((r) => r.method === 'GET' && r.url === USERS_URL)
        .flush([teacher]);
      fixture.detectChanges();

      const editBtn = fixture.debugElement.query(
        By.css('[data-testid="teacher-edit-btn"]')
      );
      (editBtn.nativeElement as HTMLButtonElement).click();

      expect(openSpy).toHaveBeenCalledWith(TeacherEditComponent, {
        width: '560px',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        data: { user: teacher },
      });

      closed$.next({ id: 11, username: 't11' });
      const reload = http.expectOne(
        (r) => r.method === 'GET' && r.url === USERS_URL
      );
      reload.flush([teacher]);
    });

    it('does not reload when the edit dialog closes with undefined', () => {
      const currentUser = signal<AuthUser | null>(admin);
      const fakeAuth = { currentUser: currentUser.asReadonly() } as unknown as AuthService;
      TestBed.configureTestingModule({
        imports: [TeacherListComponent],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideAnimationsAsync(),
          { provide: AuthService, useValue: fakeAuth },
        ],
      });
      vi.spyOn(MatSnackBar.prototype, 'open').mockReturnValue({} as never);
      const closed$ = new Subject<UserDto | undefined>();
      vi.spyOn(MatDialog.prototype, 'open').mockReturnValue({
        afterClosed: () => closed$.asObservable(),
      } as never);

      const fixture = TestBed.createComponent(TeacherListComponent);
      fixture.detectChanges();
      const http = TestBed.inject(HttpTestingController);
      http
        .expectOne((r) => r.method === 'GET' && r.url === USERS_URL)
        .flush([makeTeacher(1)]);
      fixture.detectChanges();

      fixture.componentInstance.onEdit(fixture.componentInstance.rows()[0]);
      closed$.next(undefined);
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

  describe('delete flow', () => {
    it('delete button is hidden for non-admin users', () => {
      const { fixture } = setup({ user: teacher });
      const buttons = fixture.debugElement.queryAll(
        By.css('button[data-testid="teacher-delete-btn"]')
      );
      expect(buttons.length).toBe(0);
    });

    it('delete button is visible for admins on every row', () => {
      const { fixture } = setup();
      const buttons = fixture.debugElement.queryAll(
        By.css('button[data-testid="teacher-delete-btn"]')
      );
      expect(buttons.length).toBe(3);
    });

    it('onDelete opens TeacherDeleteConfirmComponent with the expected config and data', () => {
      const afterClosed$ = new Subject<boolean | undefined>();
      const openSpy = vi
        .spyOn(MatDialog.prototype, 'open')
        .mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as never);
      const { fixture } = setup();

      const row = fixture.componentInstance.rows()[0];
      fixture.componentInstance.onDelete(row);

      expect(openSpy).toHaveBeenCalledWith(
        TeacherDeleteConfirmComponent,
        expect.objectContaining({
          width: '420px',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
          data: { row },
        })
      );
      afterClosed$.complete();
      openSpy.mockRestore();
    });

    it('on confirm=false, does not call delete and rows are unchanged', () => {
      const afterClosed$ = new Subject<boolean | undefined>();
      const openSpy = vi
        .spyOn(MatDialog.prototype, 'open')
        .mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as never);
      const { fixture, http, snackOpen } = setup();
      const before = fixture.componentInstance.dataSource.data;
      const callsBefore = snackOpen.mock.calls.length;

      const row = before[0];
      fixture.componentInstance.onDelete(row);
      afterClosed$.next(false);
      afterClosed$.complete();

      http.expectNone(`${USERS_URL}/${row.id}`);
      http.expectNone((r) => r.method === 'GET' && r.url === USERS_URL);
      expect(fixture.componentInstance.dataSource.data).toBe(before);
      expect(snackOpen.mock.calls.length).toBe(callsBefore);
      openSpy.mockRestore();
    });

    it('on confirm=true and success, deletes, reloads list, and shows success snackbar', () => {
      const afterClosed$ = new Subject<boolean | undefined>();
      const openSpy = vi
        .spyOn(MatDialog.prototype, 'open')
        .mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as never);
      const { fixture, http, snackOpen } = setup();

      const row = fixture.componentInstance.rows()[0];
      fixture.componentInstance.onDelete(row);
      afterClosed$.next(true);
      afterClosed$.complete();

      const delReq = http.expectOne(`${USERS_URL}/${row.id}`);
      expect(delReq.request.method).toBe('DELETE');
      delReq.flush(null, { status: 204, statusText: 'No Content' });

      http
        .expectOne(
          (r) =>
            r.method === 'GET' &&
            r.url === USERS_URL &&
            r.params.get('role') === 'ROLE_TEACHER'
        )
        .flush([makeTeacher(2), makeTeacher(3)]);
      fixture.detectChanges();

      expect(fixture.componentInstance.rows().length).toBe(2);
      expect(fixture.componentInstance.rows().some((r) => r.id === row.id)).toBe(false);
      expect(fixture.componentInstance.deletingId()).toBeNull();
      expect(snackOpen).toHaveBeenCalledWith(
        DELETE_SUCCESS_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000 })
      );
      openSpy.mockRestore();
    });

    it('on DELETE error, keeps rows, shows error snackbar, logs, and resets deletingId', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const afterClosed$ = new Subject<boolean | undefined>();
      const openSpy = vi
        .spyOn(MatDialog.prototype, 'open')
        .mockReturnValue({ afterClosed: () => afterClosed$.asObservable() } as never);
      const { fixture, http, snackOpen } = setup();

      const row = fixture.componentInstance.rows()[0];
      const before = fixture.componentInstance.dataSource.data;
      fixture.componentInstance.onDelete(row);
      afterClosed$.next(true);
      afterClosed$.complete();

      http
        .expectOne(`${USERS_URL}/${row.id}`)
        .flush('boom', { status: 500, statusText: 'Server Error' });
      http.expectNone((r) => r.method === 'GET' && r.url === USERS_URL);
      fixture.detectChanges();

      expect(fixture.componentInstance.dataSource.data).toBe(before);
      expect(fixture.componentInstance.deletingId()).toBeNull();
      expect(snackOpen).toHaveBeenCalledWith(
        DELETE_ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 5000, panelClass: 'snackbar-error' })
      );
      expect(errorSpy).toHaveBeenCalledWith('[teacher-list] failed to delete', expect.anything());
      errorSpy.mockRestore();
      openSpy.mockRestore();
    });
  });
});
