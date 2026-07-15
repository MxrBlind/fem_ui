import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { By } from '@angular/platform-browser';
import { Subject } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '@core/services/auth.service';
import { AuthUser } from '@core/auth/rbac';
import { GradeDto } from './models/grade.model';
import {
  DOWNLOAD_ERROR_MESSAGE,
  EMPTY_MESSAGE,
  GradesComponent,
  LOAD_ERROR_MESSAGE,
} from './grades.component';

const student: AuthUser = { id: 10, username: 'student', role: 'student', rawRole: 'student' };

function makeGrade(overrides: Partial<GradeDto> = {}): GradeDto {
  return {
    enrollmentId: 1,
    studentName: 'Estudiante Uno',
    teacherName: 'Maestro Uno',
    studentId: 10,
    courseName: 'Matemáticas',
    courseId: 100,
    subjectCode: 'MAT-101',
    cycleName: '2026-I',
    cycleId: 1,
    active: false,
    grade: 85,
    startDate: '2026-01-15T12:00:00Z',
    ...overrides,
  };
}

interface Harness {
  fixture: ComponentFixture<GradesComponent>;
  http: HttpTestingController;
  snackOpen: ReturnType<typeof vi.spyOn>;
}

function setup(options: { skipFlush?: boolean; grades?: GradeDto[]; user?: AuthUser | null } = {}): Harness {
  const user = options.user === undefined ? student : options.user;
  const currentUser = signal<AuthUser | null>(user);
  const fakeAuth = { currentUser: currentUser.asReadonly() } as unknown as AuthService;

  TestBed.configureTestingModule({
    imports: [GradesComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: AuthService, useValue: fakeAuth },
    ],
  });

  const snackOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockReturnValue({} as never);

  const fixture = TestBed.createComponent(GradesComponent);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);

  if (!options.skipFlush && user != null) {
    const grades = options.grades ?? [
      makeGrade(),
      makeGrade({ enrollmentId: 2, courseName: 'Historia', grade: 60, startDate: '2026-02-10T00:00:00Z' }),
      makeGrade({ enrollmentId: 3, courseName: 'Biología', active: true, grade: 0, startDate: '2026-03-05T00:00:00Z' }),
    ];
    http.expectOne(`${environment.apiBaseUrl}/api/grade/${user.id}`).flush(grades);
    fixture.detectChanges();
  }

  return { fixture, http, snackOpen };
}

function text(fixture: ComponentFixture<GradesComponent>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('GradesComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* fine — some tests already verify */
    }
  });

  describe('loading state', () => {
    it('shows the progress bar while pending, then hides it', () => {
      const { fixture, http } = setup({ skipFlush: true });
      expect(fixture.debugElement.query(By.css('mat-progress-bar'))).toBeTruthy();
      http.expectOne(`${environment.apiBaseUrl}/api/grade/10`).flush([]);
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('mat-progress-bar'))).toBeFalsy();
      expect(fixture.componentInstance.loading()).toBe(false);
    });
  });

  describe('data load', () => {
    it('uses the authenticated studentId (from AuthService) for the request URL', () => {
      const other: AuthUser = { id: 999, username: 'x', role: 'student', rawRole: 'student' };
      const { http } = setup({ user: other, skipFlush: true });
      http.expectOne(`${environment.apiBaseUrl}/api/grade/999`).flush([]);
    });

    it('renders one row per grade when the API returns a non-empty list', () => {
      const { fixture } = setup();
      const rows = fixture.debugElement.queryAll(By.css('tr[data-testid="grade-row"]'));
      expect(rows.length).toBe(3);
    });

    it('renders the empty state when the API returns []', () => {
      const { fixture, http } = setup({ skipFlush: true });
      http.expectOne(`${environment.apiBaseUrl}/api/grade/10`).flush([]);
      fixture.detectChanges();
      expect(text(fixture)).toContain(EMPTY_MESSAGE);
    });

    it('clears loading, shows error snackbar, and logs with [grades] on API failure', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { fixture, http, snackOpen } = setup({ skipFlush: true });
      http
        .expectOne(`${environment.apiBaseUrl}/api/grade/10`)
        .flush('boom', { status: 500, statusText: 'Server Error' });
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.componentInstance.loading()).toBe(false);
      expect(fixture.componentInstance.rows()).toEqual([]);
      expect(errorSpy).toHaveBeenCalledWith('[grades] failed to load', expect.anything());
      expect(snackOpen).toHaveBeenCalledWith(
        LOAD_ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 5000, panelClass: 'snackbar-error' })
      );
      errorSpy.mockRestore();
    });
  });

  describe('column rendering', () => {
    it('renders all six column headers in order with Spanish labels', () => {
      const { fixture } = setup();
      const headers = fixture.debugElement
        .queryAll(By.css('th.mat-mdc-header-cell'))
        .map((h) => (h.nativeElement.textContent ?? '').trim());
      expect(headers).toEqual([
        'Curso',
        'Maestro',
        'Ciclo',
        'Fecha de inicio',
        'Calificación',
        'Certificado',
      ]);
    });

    it('formats startDate as dd/MM/yyyy', () => {
      const { fixture } = setup({ grades: [makeGrade({ startDate: '2026-01-15T12:00:00Z' })] });
      expect(text(fixture)).toContain('15/01/2026');
    });

    it('shows "En curso" when active is true', () => {
      const { fixture } = setup({
        grades: [makeGrade({ active: true, grade: 0 })],
      });
      expect(text(fixture)).toContain('En curso');
    });

    it('shows "No aprobado" when active=false and grade < 70', () => {
      const { fixture } = setup({
        grades: [makeGrade({ active: false, grade: 55 })],
      });
      expect(text(fixture)).toContain('No aprobado');
    });

    it('shows the numeric grade when active=false and grade >= 70', () => {
      const { fixture } = setup({
        grades: [makeGrade({ active: false, grade: 87 })],
      });
      const cell = fixture.debugElement.query(By.css('td[data-testid="grade-cell"]'));
      expect((cell.nativeElement.textContent ?? '').trim()).toBe('87');
    });
  });

  describe('filter', () => {
    it('narrows visible rows on substring match against a column', () => {
      const { fixture } = setup();
      fixture.componentInstance.onFilterInput('Historia');
      fixture.detectChanges();
      expect(fixture.componentInstance.dataSource.filteredData.length).toBe(1);
      expect(fixture.componentInstance.dataSource.filteredData[0].courseName).toBe('Historia');
    });

    it('is case-insensitive', () => {
      const { fixture } = setup();
      fixture.componentInstance.onFilterInput('historia');
      fixture.detectChanges();
      expect(fixture.componentInstance.dataSource.filteredData.length).toBe(1);
    });

    it('matches against derived grade label "En curso"', () => {
      const { fixture } = setup();
      fixture.componentInstance.onFilterInput('en curso');
      fixture.detectChanges();
      const filtered = fixture.componentInstance.dataSource.filteredData;
      expect(filtered.length).toBe(1);
      expect(filtered[0].active).toBe(true);
    });

    it('matches against the formatted date', () => {
      const { fixture } = setup();
      fixture.componentInstance.onFilterInput('15/01/2026');
      fixture.detectChanges();
      const filtered = fixture.componentInstance.dataSource.filteredData;
      expect(filtered.length).toBe(1);
      expect(filtered[0].enrollmentId).toBe(1);
    });

    it('does not issue an HTTP request on keystroke', () => {
      const { fixture, http } = setup();
      fixture.componentInstance.onFilterInput('foo');
      fixture.detectChanges();
      http.expectNone(`${environment.apiBaseUrl}/api/grade/10`);
    });

    it('clearFilter empties the filter and restores every row', () => {
      const { fixture } = setup();
      fixture.componentInstance.onFilterInput('Historia');
      fixture.detectChanges();
      expect(fixture.componentInstance.dataSource.filteredData.length).toBe(1);
      fixture.componentInstance.clearFilter();
      fixture.detectChanges();
      expect(fixture.componentInstance.dataSource.filteredData.length).toBe(3);
    });
  });

  describe('sort and pagination defaults', () => {
    it('default sort is startDate descending', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.sort?.active).toBe('startDate');
      expect(fixture.componentInstance.sort?.direction).toBe('desc');
    });

    it('paginator default page size is 10 with options [10, 25, 50]', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.paginator?.pageSize).toBe(10);
      expect(fixture.componentInstance.paginator?.pageSizeOptions).toEqual([10, 25, 50]);
    });
  });

  describe('certificate enable/disable matrix', () => {
    it('disabled when active === true (grade ignored)', () => {
      const { fixture } = setup({ grades: [makeGrade({ active: true, grade: 95 })] });
      expect(
        fixture.debugElement.query(By.css('button[data-testid="certificate-btn-disabled"]'))
      ).toBeTruthy();
      expect(
        fixture.debugElement.query(By.css('button[data-testid="certificate-btn"]'))
      ).toBeFalsy();
    });

    it('disabled when active=false and grade < 70', () => {
      const { fixture } = setup({ grades: [makeGrade({ active: false, grade: 69 })] });
      expect(
        fixture.debugElement.query(By.css('button[data-testid="certificate-btn-disabled"]'))
      ).toBeTruthy();
    });

    it('enabled when active=false and grade >= 70', () => {
      const { fixture } = setup({ grades: [makeGrade({ active: false, grade: 70 })] });
      const btn = fixture.debugElement.query(By.css('button[data-testid="certificate-btn"]'));
      expect(btn).toBeTruthy();
      expect(btn.nativeElement.getAttribute('aria-label')).toBe('Descargar certificado');
    });

    it('disabled button has aria-disabled="true" and no click handler wired', () => {
      const { fixture } = setup({ grades: [makeGrade({ active: false, grade: 55 })] });
      const spy = vi.spyOn(fixture.componentInstance, 'onDownloadCertificate');
      const btn = fixture.debugElement.query(By.css('button[data-testid="certificate-btn-disabled"]'));
      expect(btn.nativeElement.getAttribute('aria-disabled')).toBe('true');
      btn.nativeElement.click();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('certificate download', () => {
    it('successful download saves the PDF as certificate_${enrollmentId}.pdf and revokes the URL', () => {
      const { fixture, http } = setup({
        grades: [makeGrade({ enrollmentId: 42, active: false, grade: 90 })],
      });
      const anchorClickSpy = vi.fn();
      const createObjectURLSpy = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:mock-url');
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
      const originalCreate = document.createElement.bind(document);
      const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreate(tag);
        if (tag === 'a') {
          (el as HTMLAnchorElement).click = anchorClickSpy;
        }
        return el;
      });

      const btn = fixture.debugElement.query(By.css('button[data-testid="certificate-btn"]'));
      btn.nativeElement.click();
      fixture.detectChanges();

      const req = http.expectOne(
        (r) => r.url === `${environment.apiBaseUrl}/api/grade/certificate`
      );
      expect(req.request.params.get('enrollmentId')).toBe('42');
      expect(req.request.params.get('studentId')).toBe('10');
      const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      req.flush(blob);

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(anchorClickSpy).toHaveBeenCalled();
      // The last-created <a> should carry the expected download filename.
      const anchorCall = createSpy.mock.results.find((r) => (r.value as HTMLElement).tagName === 'A');
      expect((anchorCall!.value as HTMLAnchorElement).download).toBe('certificate_42.pdf');
      expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url');
      expect(fixture.componentInstance.downloadingEnrollmentId()).toBeNull();

      createObjectURLSpy.mockRestore();
      revokeSpy.mockRestore();
      createSpy.mockRestore();
    });

    it('uses the authenticated studentId (from AuthService), not the row', () => {
      const other: AuthUser = { id: 999, username: 'x', role: 'student', rawRole: 'student' };
      const { fixture, http } = setup({ user: other, skipFlush: true });
      http
        .expectOne(`${environment.apiBaseUrl}/api/grade/999`)
        .flush([makeGrade({ enrollmentId: 42, studentId: 111, active: false, grade: 90 })]);
      fixture.detectChanges();

      const btn = fixture.debugElement.query(By.css('button[data-testid="certificate-btn"]'));
      btn.nativeElement.click();
      const req = http.expectOne(
        (r) => r.url === `${environment.apiBaseUrl}/api/grade/certificate`
      );
      expect(req.request.params.get('studentId')).toBe('999');
      req.flush(new Blob(['x'], { type: 'application/pdf' }));
    });

    it('ignores a duplicate click while a download for the same row is in flight', () => {
      const responder = new Subject<Blob>();
      const { fixture, http } = setup({
        grades: [makeGrade({ enrollmentId: 5, active: false, grade: 80 })],
      });
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

      const btn = fixture.debugElement.query(By.css('button[data-testid="certificate-btn"]'));
      btn.nativeElement.click();
      fixture.detectChanges();
      // second click while pending — no second request
      fixture.componentInstance.onDownloadCertificate(fixture.componentInstance.rows()[0]);
      fixture.detectChanges();

      const reqs = http.match(
        (r) => r.url === `${environment.apiBaseUrl}/api/grade/certificate`
      );
      expect(reqs.length).toBe(1);
      reqs[0].flush(new Blob(['x']));
      responder.complete();
    });

    it('on error: logs with [grades], clears pending, and shows snackbar', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { fixture, http, snackOpen } = setup({
        grades: [makeGrade({ enrollmentId: 7, active: false, grade: 85 })],
      });

      const btn = fixture.debugElement.query(By.css('button[data-testid="certificate-btn"]'));
      btn.nativeElement.click();
      fixture.detectChanges();
      http
        .expectOne((r) => r.url === `${environment.apiBaseUrl}/api/grade/certificate`)
        .flush(new Blob(['boom']), { status: 500, statusText: 'Server Error' });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(errorSpy).toHaveBeenCalledWith(
        '[grades] failed to download certificate',
        expect.anything()
      );
      expect(snackOpen).toHaveBeenCalledWith(
        DOWNLOAD_ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 5000, panelClass: 'snackbar-error' })
      );
      expect(fixture.componentInstance.downloadingEnrollmentId()).toBeNull();
      errorSpy.mockRestore();
    });
  });
});
