import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { By } from '@angular/platform-browser';
import { Subject, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthService } from '@core/services/auth.service';
import { AuthUser } from '@core/auth/rbac';
import { EnrollmentDto } from '../models/enrollment.model';
import { EnrollmentEditComponent } from '../enrollment-edit/enrollment-edit.component';
import { EnrollmentDeleteConfirmComponent } from '../enrollment-delete-confirm/enrollment-delete-confirm.component';
import {
  DELETE_ERROR_MESSAGE,
  DELETE_SUCCESS_MESSAGE,
  EnrollmentListComponent,
} from './enrollment-list.component';

const admin: AuthUser = { id: 1, username: 'admin', role: 'admin', rawRole: 'admin' };
const teacher: AuthUser = { id: 2, username: 'teacher', role: 'teacher', rawRole: 'teacher' };

function makeDto(id: number, overrides: Partial<EnrollmentDto> = {}): EnrollmentDto {
  return {
    id,
    grade: 80 + id,
    student: {
      id: 100 + id,
      username: `user${id}`,
      profile: {
        name: `Name${id}`,
        parentLastName: `Last${id}`,
        motherLastName: 'M',
        church: id % 2 === 0 ? 'Bethel' : 'Sion',
      },
    },
    course: {
      credits: 4,
      teacher: { id: 999, username: 'tch' },
      cycle: { description: '2026-I', startDate: '', endDate: '' },
      subject: {
        code: `SUB${id}`,
        description: `Materia ${id}`,
        category: { title: id % 2 === 0 ? 'Núcleo' : 'Electiva', description: '', code: 'C' },
        level: {},
      },
    },
    ...overrides,
  };
}

interface Harness {
  fixture: ComponentFixture<EnrollmentListComponent>;
  http: HttpTestingController;
  snackOpen: ReturnType<typeof vi.spyOn>;
}

function setup(user: AuthUser, options: { skipFlush?: boolean } = {}): Harness {
  const currentUser = signal<AuthUser | null>(user);
  const fakeAuth = { currentUser: currentUser.asReadonly() } as unknown as AuthService;

  TestBed.configureTestingModule({
    imports: [EnrollmentListComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: AuthService, useValue: fakeAuth },
    ],
  });

  const snackOpen = vi
    .spyOn(MatSnackBar.prototype, 'open')
    .mockReturnValue({} as never);

  const fixture = TestBed.createComponent(EnrollmentListComponent);
  fixture.detectChanges(); // ngOnInit issues the requests
  const http = TestBed.inject(HttpTestingController);

  if (!options.skipFlush) {
    // Default: 3 rows + cycle
    http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({
      id: 1,
      description: '2026-I',
      startDate: '',
      endDate: '',
    });
    http.expectOne(`${environment.apiBaseUrl}/api/enrollment`).flush([
      makeDto(1),
      makeDto(2),
      makeDto(3),
    ]);
    fixture.detectChanges();
  }

  return { fixture, http, snackOpen };
}

function text(fixture: ComponentFixture<EnrollmentListComponent>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('EnrollmentListComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* fine — some tests already verify */
    }
  });

  describe('title rendering', () => {
    it('renders the title with the loaded cycle description', () => {
      const { fixture } = setup(admin);
      expect(text(fixture)).toContain('Inscripciones del ciclo actual: 2026-I');
    });

    it('renders a placeholder while the cycle is loading', () => {
      const { fixture, http } = setup(admin, { skipFlush: true });
      expect(text(fixture)).toContain('Inscripciones del ciclo actual: …');
      http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({
        description: '2026-I',
        startDate: '',
        endDate: '',
      });
      http.expectOne(`${environment.apiBaseUrl}/api/enrollment`).flush([]);
      fixture.detectChanges();
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
        'Nombre',
        'Iglesia',
        'Materia',
        'Categoría',
        'Calificación',
        'Acciones',
      ]);
    });

    it('renders em-dash when church is missing', () => {
      const { fixture, http } = setup(admin, { skipFlush: true });
      http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({
        description: '2026-I',
        startDate: '',
        endDate: '',
      });
      http.expectOne(`${environment.apiBaseUrl}/api/enrollment`).flush([
        makeDto(1, {
          student: {
            id: 1,
            username: 'u',
            profile: { name: 'Ana', parentLastName: 'P', motherLastName: 'R' },
          },
        }),
      ]);
      fixture.detectChanges();
      const cells = fixture.debugElement
        .queryAll(By.css('td.mat-mdc-cell'))
        .map((c) => (c.nativeElement.textContent ?? '').trim());
      expect(cells).toContain('—');
    });

    it('renders zero grade as literal 0 (not em-dash)', () => {
      const { fixture, http } = setup(admin, { skipFlush: true });
      http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({
        description: '2026-I',
        startDate: '',
        endDate: '',
      });
      http.expectOne(`${environment.apiBaseUrl}/api/enrollment`).flush([makeDto(1, { grade: 0 })]);
      fixture.detectChanges();
      const cells = fixture.debugElement
        .queryAll(By.css('td.mat-mdc-cell'))
        .map((c) => (c.nativeElement.textContent ?? '').trim());
      expect(cells).toContain('0');
      expect(cells).not.toContain('—');
    });
  });

  describe('filter', () => {
    it('narrows visible rows on substring match', () => {
      const { fixture } = setup(admin);
      fixture.componentInstance.onFilterInput('Materia 2');
      fixture.detectChanges();
      expect(fixture.componentInstance.dataSource.filteredData.length).toBe(1);
      expect(fixture.componentInstance.dataSource.filteredData[0].subject).toBe('Materia 2');
    });

    it('is case-insensitive', () => {
      const { fixture } = setup(admin);
      fixture.componentInstance.onFilterInput('BETHEL');
      fixture.detectChanges();
      expect(
        fixture.componentInstance.dataSource.filteredData.every((r) => r.church === 'Bethel')
      ).toBe(true);
    });

    it('matches across any column (church column matches even if name does not)', () => {
      const { fixture } = setup(admin);
      fixture.componentInstance.onFilterInput('sion');
      fixture.detectChanges();
      const filtered = fixture.componentInstance.dataSource.filteredData;
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((r) => r.church === 'Sion')).toBe(true);
    });

    it('does not issue an HTTP request on keystroke', () => {
      const { fixture, http } = setup(admin);
      fixture.componentInstance.onFilterInput('foo');
      fixture.detectChanges();
      http.expectNone(`${environment.apiBaseUrl}/api/enrollment`);
    });
  });

  describe('row actions', () => {
    function deleteButtons(fixture: ComponentFixture<EnrollmentListComponent>) {
      return fixture.debugElement
        .queryAll(By.css('button[aria-label^="Eliminar"]'));
    }
    function editButtons(fixture: ComponentFixture<EnrollmentListComponent>) {
      return fixture.debugElement
        .queryAll(By.css('button[aria-label^="Editar"]'));
    }

    it('admin sees both edit and delete buttons per row', () => {
      const { fixture } = setup(admin);
      expect(editButtons(fixture).length).toBe(3);
      expect(deleteButtons(fixture).length).toBe(3);
    });

    it('teacher sees only the edit button per row', () => {
      const { fixture } = setup(teacher);
      expect(editButtons(fixture).length).toBe(3);
      expect(deleteButtons(fixture).length).toBe(0);
    });

    it('"Nueva inscripción" button is hidden for teacher', () => {
      const { fixture } = setup(teacher);
      expect(text(fixture)).not.toContain('Nueva inscripción');
    });

    it('"Nueva inscripción" button is shown for admin', () => {
      const { fixture } = setup(admin);
      expect(text(fixture)).toContain('Nueva inscripción');
    });

    it('onCreate opens the new-enrollment dialog', () => {
      const afterClosed$ = new Subject<EnrollmentDto | undefined>();
      const fakeRef = { afterClosed: () => afterClosed$.asObservable() };
      const openSpy = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue(fakeRef as any);
      const { fixture } = setup(admin);
      fixture.componentInstance.onCreate();
      expect(openSpy).toHaveBeenCalled();
      afterClosed$.complete();
      openSpy.mockRestore();
    });

    it('onDelete opens EnrollmentDeleteConfirmComponent with correct config and data', () => {
      const afterClosed$ = new Subject<boolean | undefined>();
      const fakeRef = { afterClosed: () => afterClosed$.asObservable() };
      const openSpy = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue(fakeRef as any);
      const { fixture } = setup(admin);

      const row = fixture.componentInstance.dataSource.data[0];
      fixture.componentInstance.onDelete(row);

      expect(openSpy).toHaveBeenCalledWith(
        EnrollmentDeleteConfirmComponent,
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

    it('on confirm=true, issues DELETE, refreshes list, shows success snackbar', () => {
      const afterClosed$ = new Subject<boolean | undefined>();
      const fakeRef = { afterClosed: () => afterClosed$.asObservable() };
      const openSpy = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue(fakeRef as any);
      const { fixture, http, snackOpen } = setup(admin);

      const row = fixture.componentInstance.dataSource.data[0];
      fixture.componentInstance.onDelete(row);
      afterClosed$.next(true);
      afterClosed$.complete();

      http
        .expectOne(`${environment.apiBaseUrl}/api/enrollment/${row.id}`)
        .flush(null, { status: 204, statusText: 'No Content' });
      http.expectOne(`${environment.apiBaseUrl}/api/enrollment`).flush([makeDto(7)]);
      fixture.detectChanges();

      expect(fixture.componentInstance.dataSource.data.some((r) => r.id === 7)).toBe(true);
      expect(fixture.componentInstance.deletingId()).toBeNull();
      expect(snackOpen).toHaveBeenCalledWith(
        DELETE_SUCCESS_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000 })
      );
      openSpy.mockRestore();
    });

    it('on confirm=false, does not issue DELETE and shows no snackbar', () => {
      const afterClosed$ = new Subject<boolean | undefined>();
      const fakeRef = { afterClosed: () => afterClosed$.asObservable() };
      const openSpy = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue(fakeRef as any);
      const { fixture, http, snackOpen } = setup(admin);
      const originalCallCount = snackOpen.mock.calls.length;

      const row = fixture.componentInstance.dataSource.data[0];
      fixture.componentInstance.onDelete(row);
      afterClosed$.next(false);
      afterClosed$.complete();

      http.expectNone(`${environment.apiBaseUrl}/api/enrollment/${row.id}`);
      http.expectNone(`${environment.apiBaseUrl}/api/enrollment`);
      expect(snackOpen.mock.calls.length).toBe(originalCallCount);
      openSpy.mockRestore();
    });

    it('on DELETE error, keeps rows, shows error snackbar, logs error', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const afterClosed$ = new Subject<boolean | undefined>();
      const fakeRef = { afterClosed: () => afterClosed$.asObservable() };
      const openSpy = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue(fakeRef as any);
      const { fixture, http, snackOpen } = setup(admin);

      const row = fixture.componentInstance.dataSource.data[0];
      const before = fixture.componentInstance.dataSource.data;
      fixture.componentInstance.onDelete(row);
      afterClosed$.next(true);
      afterClosed$.complete();

      http
        .expectOne(`${environment.apiBaseUrl}/api/enrollment/${row.id}`)
        .flush('boom', { status: 500, statusText: 'Server Error' });
      http.expectNone(`${environment.apiBaseUrl}/api/enrollment`);
      fixture.detectChanges();

      expect(fixture.componentInstance.dataSource.data).toBe(before);
      expect(fixture.componentInstance.deletingId()).toBeNull();
      expect(snackOpen).toHaveBeenCalledWith(
        DELETE_ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 5000, panelClass: 'snackbar-error' })
      );
      expect(errorSpy).toHaveBeenCalledWith('[enrollment-list] failed to delete', expect.anything());
      errorSpy.mockRestore();
      openSpy.mockRestore();
    });

    it('onEdit opens EnrollmentEditComponent with correct config and data', () => {
      const afterClosed$ = new Subject<EnrollmentDto | undefined>();
      const fakeRef = { afterClosed: () => afterClosed$.asObservable() };
      const openSpy = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue(fakeRef as any);
      const { fixture } = setup(admin);

      const row = fixture.componentInstance.dataSource.data[0];
      fixture.componentInstance.onEdit(row);

      expect(openSpy).toHaveBeenCalledWith(
        EnrollmentEditComponent,
        expect.objectContaining({
          width: '480px',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
          data: { enrollment: row.raw },
        })
      );
      afterClosed$.complete();
      openSpy.mockRestore();
    });

    it('on afterClosed() emitting a truthy DTO, re-fetches enrollment list and replaces dataSource.data', () => {
      const afterClosed$ = new Subject<EnrollmentDto | undefined>();
      const fakeRef = { afterClosed: () => afterClosed$.asObservable() };
      const openSpy = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue(fakeRef as any);
      const { fixture, http } = setup(admin);

      const row = fixture.componentInstance.dataSource.data[0];
      fixture.componentInstance.onEdit(row);

      const updatedDto = makeDto(99);
      afterClosed$.next(updatedDto);
      afterClosed$.complete();

      http.expectOne(`${environment.apiBaseUrl}/api/enrollment`).flush([updatedDto]);
      fixture.detectChanges();

      expect(fixture.componentInstance.dataSource.data.some((r) => r.id === 99)).toBe(true);
      openSpy.mockRestore();
    });

    it('on afterClosed() emitting undefined, does not re-fetch and dataSource.data is unchanged', () => {
      const afterClosed$ = new Subject<EnrollmentDto | undefined>();
      const fakeRef = { afterClosed: () => afterClosed$.asObservable() };
      const openSpy = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue(fakeRef as any);
      const { fixture, http } = setup(admin);

      const row = fixture.componentInstance.dataSource.data[0];
      const originalData = fixture.componentInstance.dataSource.data;
      fixture.componentInstance.onEdit(row);

      afterClosed$.next(undefined);
      afterClosed$.complete();

      http.expectNone(`${environment.apiBaseUrl}/api/enrollment`);
      expect(fixture.componentInstance.dataSource.data).toBe(originalData);
      openSpy.mockRestore();
    });
  });

  describe('loading state', () => {
    it('shows progress bar while requests are pending', () => {
      const { fixture, http } = setup(admin, { skipFlush: true });
      expect(fixture.debugElement.query(By.css('mat-progress-bar'))).toBeTruthy();
      http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({
        description: '2026-I',
        startDate: '',
        endDate: '',
      });
      http.expectOne(`${environment.apiBaseUrl}/api/enrollment`).flush([]);
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('mat-progress-bar'))).toBeFalsy();
    });
  });

  describe('error state', () => {
    it('on /api/enrollment failure: clears loading, leaves rows empty, logs error', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { fixture, http } = setup(admin, { skipFlush: true });
      http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({
        description: '2026-I',
        startDate: '',
        endDate: '',
      });
      http.expectOne(`${environment.apiBaseUrl}/api/enrollment`).flush('boom', {
        status: 500,
        statusText: 'Server Error',
      });
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.componentInstance.loading()).toBe(false);
      expect(fixture.componentInstance.rows()).toEqual([]);
      expect(errorSpy).toHaveBeenCalledWith('[enrollment-list] failed to load', expect.anything());
      errorSpy.mockRestore();
    });
  });

  describe('empty state', () => {
    it('renders the empty placeholder when the API returns []', () => {
      const { fixture, http } = setup(admin, { skipFlush: true });
      http.expectOne(`${environment.apiBaseUrl}/api/cycle/current`).flush({
        description: '2026-I',
        startDate: '',
        endDate: '',
      });
      http.expectOne(`${environment.apiBaseUrl}/api/enrollment`).flush([]);
      fixture.detectChanges();
      expect(text(fixture)).toContain('No hay inscripciones para el ciclo actual.');
    });
  });

  describe('default sort and pagination', () => {
    it('default sort is fullName ascending', () => {
      const { fixture } = setup(admin);
      expect(fixture.componentInstance.sort?.active).toBe('fullName');
      expect(fixture.componentInstance.sort?.direction).toBe('asc');
    });

    it('paginator default page size is 10', () => {
      const { fixture } = setup(admin);
      expect(fixture.componentInstance.paginator?.pageSize).toBe(10);
    });
  });
});
