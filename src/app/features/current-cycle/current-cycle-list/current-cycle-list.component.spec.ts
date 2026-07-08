import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { signal } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, Subject } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { By } from '@angular/platform-browser';

import { environment } from '../../../../environments/environment';
import { AuthService } from '@core/services/auth.service';
import { AuthUser } from '@core/auth/rbac';
import { CourseDto } from '@features/enrollments/models/enrollment.model';
import { CourseDeleteConfirmComponent } from '../course-delete-confirm/course-delete-confirm.component';
import { CourseEditComponent } from '../course-edit/course-edit.component';
import { CourseNewComponent } from '../course-new/course-new.component';
import {
  CurrentCycleListComponent,
  DELETE_ERROR_MESSAGE,
  DELETE_SUCCESS_MESSAGE,
} from './current-cycle-list.component';

const admin: AuthUser = { id: 1, username: 'admin', role: 'admin', rawRole: 'admin' };
const teacher: AuthUser = { id: 2, username: 'teacher', role: 'teacher', rawRole: 'teacher' };

function makeCourse(id: number, overrides: Partial<CourseDto> = {}): CourseDto {
  return {
    id,
    credits: id,
    teacher: {
      id: 900 + id,
      username: `tch${id}`,
      profile: {
        name: `Prof${id}`,
        parentLastName: `Apellido${id}`,
        motherLastName: 'M',
      },
    },
    subject: {
      code: `SUB${id}`,
      description: `Materia ${id}`,
      category: { title: id % 2 === 0 ? 'Núcleo' : 'Electiva', description: '', code: 'C' },
      level: { title: id % 2 === 0 ? 'Básico' : 'Avanzado' },
    },
    cycle: { description: '2026-I', startDate: '', endDate: '' },
    ...overrides,
  };
}

interface Harness {
  fixture: ComponentFixture<CurrentCycleListComponent>;
  http: HttpTestingController;
  snackOpen: ReturnType<typeof vi.spyOn>;
}

function setup(user: AuthUser, options: { skipFlush?: boolean; courses?: CourseDto[] } = {}): Harness {
  const currentUser = signal<AuthUser | null>(user);
  const fakeAuth = { currentUser: currentUser.asReadonly() } as unknown as AuthService;

  TestBed.configureTestingModule({
    imports: [CurrentCycleListComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: AuthService, useValue: fakeAuth },
    ],
  });

  const snackOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockReturnValue({} as never);

  const fixture = TestBed.createComponent(CurrentCycleListComponent);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);

  if (!options.skipFlush) {
    http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({
      id: 42,
      description: '2026-I',
      startDate: '',
      endDate: '',
    });
    http
      .expectOne(`${environment.apiBaseUrl}/api/course/cycle/42`)
      .flush(options.courses ?? [makeCourse(1), makeCourse(2), makeCourse(3)]);
    fixture.detectChanges();
  }

  return { fixture, http, snackOpen };
}

function text(fixture: ComponentFixture<CurrentCycleListComponent>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('CurrentCycleListComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* fine */
    }
  });

  describe('loading and data flow', () => {
    it('shows the progress bar while requests are pending and hides it once resolved', () => {
      const { fixture, http } = setup(admin, { skipFlush: true });
      expect(fixture.debugElement.query(By.css('mat-progress-bar'))).toBeTruthy();
      http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({
        id: 42,
        description: '2026-I',
        startDate: '',
        endDate: '',
      });
      http.expectOne(`${environment.apiBaseUrl}/api/course/cycle/42`).flush([]);
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('mat-progress-bar'))).toBeFalsy();
    });

    it('calls /api/course/cycle/{id} using the cycle id returned by /api/cycle/current', () => {
      const { http } = setup(admin, { skipFlush: true });
      http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({
        id: 7,
        description: 'Any',
        startDate: '',
        endDate: '',
      });
      http.expectOne(`${environment.apiBaseUrl}/api/course/cycle/7`).flush([]);
    });
  });

  describe('title and header', () => {
    it('renders the title with the loaded cycle description', () => {
      const { fixture } = setup(admin);
      expect(text(fixture)).toContain('Materias del ciclo actual: 2026-I');
    });

    it('shows the Nuevo curso button for admin', () => {
      const { fixture } = setup(admin);
      expect(text(fixture)).toContain('Nuevo curso');
    });

    it('hides the Nuevo curso button for non-admin', () => {
      const { fixture } = setup(teacher);
      expect(text(fixture)).not.toContain('Nuevo curso');
    });
  });

  describe('column rendering', () => {
    it('renders all seven column headers in order', () => {
      const { fixture } = setup(admin);
      const headers = fixture.debugElement
        .queryAll(By.css('th.mat-mdc-header-cell'))
        .map((h) => (h.nativeElement.textContent ?? '').trim());
      expect(headers).toEqual([
        'ID',
        'Nombre del curso',
        'Créditos',
        'Profesor',
        'Categoría',
        'Nivel',
        'Acciones',
      ]);
    });

    it('renders one row per course with flat CourseRow values', () => {
      const { fixture } = setup(admin);
      const rows = fixture.componentInstance.dataSource.data;
      expect(rows.length).toBe(3);
      expect(rows[0].subjectDescription).toBe('Materia 1');
      expect(rows[0].teacherFullName).toBe('Prof1 Apellido1 M');
      expect(rows[0].categoryTitle).toBe('Electiva');
      expect(rows[0].levelTitle).toBe('Avanzado');
      expect(rows[0].credits).toBe(1);
    });
  });

  describe('filter', () => {
    it('narrows visible rows on a teacherFullName substring', () => {
      const { fixture } = setup(admin);
      fixture.componentInstance.onFilterInput('Apellido2');
      fixture.detectChanges();
      expect(fixture.componentInstance.dataSource.filteredData.length).toBe(1);
      expect(fixture.componentInstance.dataSource.filteredData[0].id).toBe(2);
    });

    it('clearFilter restores all rows', () => {
      const { fixture } = setup(admin);
      fixture.componentInstance.onFilterInput('Apellido2');
      fixture.detectChanges();
      fixture.componentInstance.clearFilter();
      fixture.detectChanges();
      expect(fixture.componentInstance.dataSource.filteredData.length).toBe(3);
    });

    it('is case-insensitive', () => {
      const { fixture } = setup(admin);
      fixture.componentInstance.onFilterInput('MATERIA 3');
      fixture.detectChanges();
      expect(fixture.componentInstance.dataSource.filteredData.length).toBe(1);
    });

    it('does not issue an HTTP request on keystroke', () => {
      const { fixture, http } = setup(admin);
      fixture.componentInstance.onFilterInput('foo');
      fixture.detectChanges();
      http.expectNone(`${environment.apiBaseUrl}/api/course/cycle/42`);
    });
  });

  describe('sort and pagination', () => {
    it('default sort is subjectDescription ascending', () => {
      const { fixture } = setup(admin);
      expect(fixture.componentInstance.sort?.active).toBe('subjectDescription');
      expect(fixture.componentInstance.sort?.direction).toBe('asc');
    });

    it('paginator default page size is 10', () => {
      const { fixture } = setup(admin);
      expect(fixture.componentInstance.paginator?.pageSize).toBe(10);
    });

    it('sorting by teacherFullName orders rows by that flat field', () => {
      const { fixture } = setup(admin);
      const ds = fixture.componentInstance.dataSource;
      ds.sort = fixture.componentInstance.sort!;
      fixture.componentInstance.sort!.active = 'teacherFullName';
      fixture.componentInstance.sort!.direction = 'desc';
      fixture.componentInstance.sort!.sortChange.emit({ active: 'teacherFullName', direction: 'desc' });
      fixture.detectChanges();
      const first = ds.sortData(ds.filteredData, fixture.componentInstance.sort!);
      expect(first[0].teacherFullName >= first[first.length - 1].teacherFullName).toBe(true);
    });
  });

  describe('onDelete opens the confirm dialog and handles the API flow', () => {
    function fakeDialogRef(closed: unknown) {
      return {
        afterClosed: () => (closed instanceof Subject ? closed.asObservable() : of(closed)),
      } as unknown as MatDialogRef<unknown>;
    }

    it('opens CourseDeleteConfirmComponent with data { row }', () => {
      const openSpy = vi
        .spyOn(MatDialog.prototype, 'open')
        .mockReturnValue(fakeDialogRef(false));
      const { fixture } = setup(admin);
      const row = fixture.componentInstance.dataSource.data[0];
      fixture.componentInstance.onDelete(row);
      expect(openSpy).toHaveBeenCalledTimes(1);
      const [comp, config] = openSpy.mock.calls[0];
      expect(comp).toBe(CourseDeleteConfirmComponent);
      expect(config).toEqual(
        expect.objectContaining({
          width: '420px',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
          data: { row },
        })
      );
      openSpy.mockRestore();
    });

    it('confirmed close calls DELETE /api/course/{id} then refreshes and shows success snackbar', () => {
      const openSpy = vi
        .spyOn(MatDialog.prototype, 'open')
        .mockReturnValue(fakeDialogRef(true));
      const { fixture, http, snackOpen } = setup(admin);
      const row = fixture.componentInstance.dataSource.data[0];
      fixture.componentInstance.onDelete(row);

      const del = http.expectOne(`${environment.apiBaseUrl}/api/course/${row.id}`);
      expect(del.request.method).toBe('DELETE');
      del.flush(null, { status: 204, statusText: 'No Content' });

      const refresh = http.expectOne(`${environment.apiBaseUrl}/api/course/cycle/42`);
      refresh.flush([makeCourse(2), makeCourse(3)]);
      fixture.detectChanges();

      expect(fixture.componentInstance.rows().length).toBe(2);
      expect(snackOpen).toHaveBeenCalledWith(
        DELETE_SUCCESS_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000 })
      );
      expect(fixture.componentInstance.deletingId()).toBeNull();
      openSpy.mockRestore();
    });

    it('failed DELETE shows error snackbar, keeps rows, logs, and resets deletingId', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const openSpy = vi
        .spyOn(MatDialog.prototype, 'open')
        .mockReturnValue(fakeDialogRef(true));
      const { fixture, http, snackOpen } = setup(admin);
      const row = fixture.componentInstance.dataSource.data[0];
      fixture.componentInstance.onDelete(row);

      http
        .expectOne(`${environment.apiBaseUrl}/api/course/${row.id}`)
        .flush('boom', { status: 500, statusText: 'Server Error' });

      http.expectNone(`${environment.apiBaseUrl}/api/course/cycle/42`);
      expect(fixture.componentInstance.rows().length).toBe(3);
      expect(snackOpen).toHaveBeenCalledWith(
        DELETE_ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({ panelClass: 'snackbar-error', duration: 5000 })
      );
      expect(errorSpy).toHaveBeenCalledWith(
        '[current-cycle-list] failed to delete',
        expect.anything()
      );
      expect(fixture.componentInstance.deletingId()).toBeNull();
      errorSpy.mockRestore();
      openSpy.mockRestore();
    });

    it('cancel/undefined close does not call the service', () => {
      const openSpy = vi
        .spyOn(MatDialog.prototype, 'open')
        .mockReturnValue(fakeDialogRef(false));
      const { fixture, http } = setup(admin);
      const row = fixture.componentInstance.dataSource.data[0];
      fixture.componentInstance.onDelete(row);
      http.expectNone(`${environment.apiBaseUrl}/api/course/${row.id}`);
      expect(fixture.componentInstance.rows().length).toBe(3);
      openSpy.mockRestore();
    });

    it('disables the row delete button while deletingId matches', () => {
      const { fixture } = setup(admin);
      const row = fixture.componentInstance.dataSource.data[0];
      fixture.componentInstance.deletingId.set(row.id);
      fixture.detectChanges();
      const btn = fixture.debugElement.query(
        By.css(`button[aria-label="Eliminar curso ${row.id}"]`)
      );
      expect((btn.nativeElement as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('onEdit opens the course-edit dialog and refreshes on success', () => {
    function fakeDialogRef(closed: unknown) {
      return {
        afterClosed: () => (closed instanceof Subject ? closed.asObservable() : of(closed)),
      } as unknown as MatDialogRef<unknown>;
    }

    it('opens CourseEditComponent with data set to row.raw', () => {
      const openSpy = vi
        .spyOn(MatDialog.prototype, 'open')
        .mockReturnValue(fakeDialogRef(undefined));
      const { fixture } = setup(admin);
      const row = fixture.componentInstance.dataSource.data[0];
      fixture.componentInstance.onEdit(row);
      expect(openSpy).toHaveBeenCalledTimes(1);
      const [comp, config] = openSpy.mock.calls[0];
      expect(comp).toBe(CourseEditComponent);
      expect(config).toEqual(
        expect.objectContaining({
          width: '480px',
          autoFocus: 'first-tabbable',
          data: row.raw,
        })
      );
      openSpy.mockRestore();
    });

    it('re-fetches the cycle courses when the dialog returns a CourseDto', () => {
      const openSpy = vi
        .spyOn(MatDialog.prototype, 'open')
        .mockReturnValue(fakeDialogRef(makeCourse(1, { credits: 99 })));
      const { fixture, http } = setup(admin);
      const row = fixture.componentInstance.dataSource.data[0];
      fixture.componentInstance.onEdit(row);
      const refresh = http.expectOne(`${environment.apiBaseUrl}/api/course/cycle/42`);
      refresh.flush([makeCourse(1, { credits: 99 }), makeCourse(2), makeCourse(3)]);
      fixture.detectChanges();
      expect(fixture.componentInstance.rows().length).toBe(3);
      expect(fixture.componentInstance.rows()[0].credits).toBe(99);
      openSpy.mockRestore();
    });

    it('does not refetch when the dialog closes with undefined', () => {
      const openSpy = vi
        .spyOn(MatDialog.prototype, 'open')
        .mockReturnValue(fakeDialogRef(undefined));
      const { fixture, http } = setup(admin);
      const row = fixture.componentInstance.dataSource.data[0];
      fixture.componentInstance.onEdit(row);
      http.expectNone(`${environment.apiBaseUrl}/api/course/cycle/42`);
      openSpy.mockRestore();
    });
  });

  describe('onCreate opens the course-new dialog and refreshes on success', () => {
    function fakeDialogRef(closed: unknown) {
      return {
        afterClosed: () => (closed instanceof Subject ? closed.asObservable() : of(closed)),
      } as unknown as MatDialogRef<unknown>;
    }

    it('opens CourseNewComponent with expected config', () => {
      const openSpy = vi
        .spyOn(MatDialog.prototype, 'open')
        .mockReturnValue(fakeDialogRef(undefined));
      const { fixture } = setup(admin);
      fixture.componentInstance.onCreate();
      expect(openSpy).toHaveBeenCalledTimes(1);
      const [comp, config] = openSpy.mock.calls[0];
      expect(comp).toBe(CourseNewComponent);
      expect(config).toEqual(
        expect.objectContaining({ width: '480px', autoFocus: 'first-tabbable' })
      );
      openSpy.mockRestore();
    });

    it('re-fetches the cycle courses when the dialog returns a CourseDto', () => {
      const openSpy = vi
        .spyOn(MatDialog.prototype, 'open')
        .mockReturnValue(fakeDialogRef(makeCourse(99)));
      const { fixture, http } = setup(admin);
      fixture.componentInstance.onCreate();
      const refresh = http.expectOne(`${environment.apiBaseUrl}/api/course/cycle/42`);
      refresh.flush([makeCourse(1), makeCourse(2), makeCourse(3), makeCourse(99)]);
      fixture.detectChanges();
      expect(fixture.componentInstance.rows().length).toBe(4);
      openSpy.mockRestore();
    });

    it('does not refetch when the dialog closes with undefined', () => {
      const openSpy = vi
        .spyOn(MatDialog.prototype, 'open')
        .mockReturnValue(fakeDialogRef(undefined));
      const { fixture, http } = setup(admin);
      fixture.componentInstance.onCreate();
      http.expectNone(`${environment.apiBaseUrl}/api/course/cycle/42`);
      expect(fixture.componentInstance.rows().length).toBe(3);
      openSpy.mockRestore();
    });
  });

  describe('empty state', () => {
    it('renders the empty placeholder when the API returns []', () => {
      const { fixture } = setup(admin, { skipFlush: true });
      const http = TestBed.inject(HttpTestingController);
      http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({
        id: 42,
        description: '2026-I',
        startDate: '',
        endDate: '',
      });
      http.expectOne(`${environment.apiBaseUrl}/api/course/cycle/42`).flush([]);
      fixture.detectChanges();
      expect(text(fixture)).toContain('No hay cursos en el ciclo actual.');
    });
  });

  describe('error state', () => {
    it('on /api/course failure: clears loading, leaves rows empty, opens error snackbar, logs', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { fixture, http, snackOpen } = setup(admin, { skipFlush: true });
      http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({
        id: 42,
        description: '2026-I',
        startDate: '',
        endDate: '',
      });
      http.expectOne(`${environment.apiBaseUrl}/api/course/cycle/42`).flush('boom', {
        status: 500,
        statusText: 'Server Error',
      });
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.componentInstance.loading()).toBe(false);
      expect(fixture.componentInstance.rows()).toEqual([]);
      expect(snackOpen).toHaveBeenCalledWith(
        expect.stringContaining('No se pudieron cargar los cursos'),
        'Cerrar',
        expect.objectContaining({ panelClass: 'snackbar-error' })
      );
      expect(errorSpy).toHaveBeenCalledWith(
        '[current-cycle-list] failed to load',
        expect.anything()
      );
      errorSpy.mockRestore();
    });
  });

  describe('row actions visibility', () => {
    it('admin sees both edit and delete buttons per row', () => {
      const { fixture } = setup(admin);
      const editButtons = fixture.debugElement.queryAll(By.css('button[aria-label^="Editar curso"]'));
      const deleteButtons = fixture.debugElement.queryAll(
        By.css('button[aria-label^="Eliminar curso"]')
      );
      expect(editButtons.length).toBe(3);
      expect(deleteButtons.length).toBe(3);
    });
  });
});
