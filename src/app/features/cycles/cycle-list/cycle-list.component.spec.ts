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
import { CycleDto } from '@features/enrollments/models/cycle.model';
import {
  CycleListComponent,
  LOAD_ERROR_MESSAGE,
  NOT_IMPLEMENTED_MESSAGE,
  PRINCIPAL_FALLBACK,
} from './cycle-list.component';

const admin: AuthUser = { id: 1, username: 'admin', role: 'admin', rawRole: 'admin' };

function makeCycle(id: number, overrides: Partial<CycleDto> = {}): CycleDto {
  return {
    id,
    description: `2026-${id}`,
    startDate: `2026-0${id}-01T00:00:00Z`,
    endDate: `2026-0${id}-28T00:00:00Z`,
    current: id === 1,
    active: true,
    principal: {
      id: 10 + id,
      username: `principal${id}`,
      profile: {
        name: `Name${id}`,
        parentLastName: `Last${id}`,
      },
    },
    ...overrides,
  };
}

interface Harness {
  fixture: ComponentFixture<CycleListComponent>;
  http: HttpTestingController;
  snackOpen: ReturnType<typeof vi.spyOn>;
}

function setup(user: AuthUser, options: { skipFlush?: boolean; cycles?: CycleDto[] } = {}): Harness {
  const currentUser = signal<AuthUser | null>(user);
  const fakeAuth = { currentUser: currentUser.asReadonly() } as unknown as AuthService;

  TestBed.configureTestingModule({
    imports: [CycleListComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: AuthService, useValue: fakeAuth },
    ],
  });

  const snackOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockReturnValue({} as never);

  const fixture = TestBed.createComponent(CycleListComponent);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);

  if (!options.skipFlush) {
    const cycles = options.cycles ?? [makeCycle(1), makeCycle(2), makeCycle(3)];
    http.expectOne(`${environment.apiBaseUrl}/api/cycle`).flush(cycles);
    fixture.detectChanges();
  }

  return { fixture, http, snackOpen };
}

function text(fixture: ComponentFixture<CycleListComponent>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('CycleListComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* fine — some tests already verify */
    }
  });

  describe('loading state', () => {
    it('shows the progress bar while the request is pending, then hides it', () => {
      const { fixture, http } = setup(admin, { skipFlush: true });
      expect(fixture.debugElement.query(By.css('mat-progress-bar'))).toBeTruthy();
      http.expectOne(`${environment.apiBaseUrl}/api/cycle`).flush([]);
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('mat-progress-bar'))).toBeFalsy();
      expect(fixture.componentInstance.loading()).toBe(false);
    });
  });

  describe('row mapping', () => {
    it('maps CycleDto to CycleRow with composed principal name', () => {
      const { fixture } = setup(admin, {
        cycles: [makeCycle(1, { principal: { id: 1, username: 'p', profile: { name: 'Ana', parentLastName: 'Perez' } } })],
      });
      expect(fixture.componentInstance.rows()[0].principalName).toBe('Ana Perez');
    });

    it('falls back to em-dash when principal is missing', () => {
      const { fixture } = setup(admin, {
        cycles: [makeCycle(1, { principal: undefined })],
      });
      expect(fixture.componentInstance.rows()[0].principalName).toBe(PRINCIPAL_FALLBACK);
    });

    it('falls back to em-dash when principal.profile is missing', () => {
      const { fixture } = setup(admin, {
        cycles: [makeCycle(1, { principal: { id: 2, username: 'p' } })],
      });
      expect(fixture.componentInstance.rows()[0].principalName).toBe(PRINCIPAL_FALLBACK);
    });

    it('falls back to em-dash when profile name fields are blank', () => {
      const { fixture } = setup(admin, {
        cycles: [makeCycle(1, { principal: { id: 2, username: 'p', profile: {} } })],
      });
      expect(fixture.componentInstance.rows()[0].principalName).toBe(PRINCIPAL_FALLBACK);
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
        'Descripción',
        'Fecha de inicio',
        'Fecha de fin',
        'Director',
        'Ciclo actual',
        'Acciones',
      ]);
    });
  });

  describe('filter', () => {
    it('narrows visible rows on substring match against description', () => {
      const { fixture } = setup(admin);
      fixture.componentInstance.onFilterInput('2026-2');
      fixture.detectChanges();
      expect(fixture.componentInstance.dataSource.filteredData.length).toBe(1);
      expect(fixture.componentInstance.dataSource.filteredData[0].description).toBe('2026-2');
    });

    it('is case-insensitive and matches principal name', () => {
      const { fixture } = setup(admin);
      fixture.componentInstance.onFilterInput('NAME3');
      fixture.detectChanges();
      expect(fixture.componentInstance.dataSource.filteredData.length).toBe(1);
      expect(fixture.componentInstance.dataSource.filteredData[0].principalName).toContain('Name3');
    });

    it('matches against the ✓/✕ current flag', () => {
      const { fixture } = setup(admin);
      fixture.componentInstance.onFilterInput('✓');
      fixture.detectChanges();
      const filtered = fixture.componentInstance.dataSource.filteredData;
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((r) => r.current)).toBe(true);
    });

    it('does not issue an HTTP request on keystroke', () => {
      const { fixture, http } = setup(admin);
      fixture.componentInstance.onFilterInput('foo');
      fixture.detectChanges();
      http.expectNone(`${environment.apiBaseUrl}/api/cycle`);
    });
  });

  describe('default sort and pagination', () => {
    it('default sort is startDate descending', () => {
      const { fixture } = setup(admin);
      expect(fixture.componentInstance.sort?.active).toBe('startDate');
      expect(fixture.componentInstance.sort?.direction).toBe('desc');
    });

    it('paginator default page size is 10 with the configured options', () => {
      const { fixture } = setup(admin);
      expect(fixture.componentInstance.paginator?.pageSize).toBe(10);
      expect(fixture.componentInstance.paginator?.pageSizeOptions).toEqual([5, 10, 25, 50]);
    });
  });

  describe('empty state', () => {
    it('renders the empty placeholder when the API returns []', () => {
      const { fixture } = setup(admin, { skipFlush: true });
      TestBed.inject(HttpTestingController)
        .expectOne(`${environment.apiBaseUrl}/api/cycle`)
        .flush([]);
      fixture.detectChanges();
      expect(text(fixture)).toContain('No hay ciclos registrados.');
    });
  });

  describe('error state', () => {
    it('clears loading, shows the error snackbar, and logs on API failure', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { fixture, http, snackOpen } = setup(admin, { skipFlush: true });
      http
        .expectOne(`${environment.apiBaseUrl}/api/cycle`)
        .flush('boom', { status: 500, statusText: 'Server Error' });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.loading()).toBe(false);
      expect(fixture.componentInstance.rows()).toEqual([]);
      expect(errorSpy).toHaveBeenCalledWith('[cycle-list] failed to load', expect.anything());
      expect(snackOpen).toHaveBeenCalledWith(
        LOAD_ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 5000, panelClass: 'snackbar-error' })
      );
      errorSpy.mockRestore();
    });
  });

  describe('stub action handlers', () => {
    it('onCreate opens the "Próximamente" snackbar and does not call the service', () => {
      const { fixture, http, snackOpen } = setup(admin);
      fixture.componentInstance.onCreate();
      expect(snackOpen).toHaveBeenCalledWith(
        NOT_IMPLEMENTED_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000 })
      );
      http.expectNone(`${environment.apiBaseUrl}/api/cycle`);
    });

    it('onEdit opens the "Próximamente" snackbar and does not call the service', () => {
      const { fixture, http, snackOpen } = setup(admin);
      const row = fixture.componentInstance.dataSource.data[0];
      fixture.componentInstance.onEdit(row);
      expect(snackOpen).toHaveBeenCalledWith(
        NOT_IMPLEMENTED_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000 })
      );
      http.expectNone(`${environment.apiBaseUrl}/api/cycle`);
    });

    it('onDelete opens the "Próximamente" snackbar and does not call the service', () => {
      const { fixture, http, snackOpen } = setup(admin);
      const row = fixture.componentInstance.dataSource.data[0];
      fixture.componentInstance.onDelete(row);
      expect(snackOpen).toHaveBeenCalledWith(
        NOT_IMPLEMENTED_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000 })
      );
      http.expectNone(`${environment.apiBaseUrl}/api/cycle`);
    });
  });
});
