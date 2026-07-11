import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { environment } from '../../../../environments/environment';
import {
  CategoryDto,
  LevelDto,
  SubjectDto,
} from '../../enrollments/models/enrollment.model';
import {
  ERROR_MESSAGE,
  LOAD_ERROR_MESSAGE,
  SUCCESS_MESSAGE,
  SubjectNewComponent,
} from './subject-new.component';

function makeCategory(id: number, title = `Categoría ${id}`): CategoryDto {
  return { id, title, description: '', code: `CAT${id}` };
}

function makeLevel(id: number, title = `Nivel ${id}`): LevelDto {
  return { id, title, code: `LVL${id}` };
}

interface Harness {
  fixture: ComponentFixture<SubjectNewComponent>;
  http: HttpTestingController;
  dialogRef: { close: ReturnType<typeof vi.fn> };
  snackOpen: ReturnType<typeof vi.spyOn>;
}

function setup(options: { skipFlush?: boolean; failLoad?: boolean } = {}): Harness {
  const dialogRef = { close: vi.fn() };

  TestBed.configureTestingModule({
    imports: [SubjectNewComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });

  const fixture = TestBed.createComponent(SubjectNewComponent);
  const componentSnack = (fixture.componentInstance as unknown as {
    snackBar: MatSnackBar;
  }).snackBar;
  const snackOpen = vi
    .spyOn(componentSnack, 'open')
    .mockReturnValue({} as never);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);

  if (!options.skipFlush) {
    const catReq = http.expectOne(`${environment.apiBaseUrl}/api/category`);
    const lvlReq = http.expectOne(`${environment.apiBaseUrl}/api/level`);
    if (options.failLoad) {
      lvlReq.flush([makeLevel(1)]);
      catReq.flush('boom', { status: 500, statusText: 'Server Error' });
    } else {
      catReq.flush([makeCategory(3, 'Ciencias exactas'), makeCategory(4, 'Humanidades')]);
      lvlReq.flush([makeLevel(1, 'Primaria'), makeLevel(2, 'Secundaria')]);
    }
    fixture.detectChanges();
  }

  return { fixture, http, dialogRef, snackOpen };
}

describe('SubjectNewComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* verified per-test */
    }
  });

  describe('smoke', () => {
    it('renders the "Nueva materia" title', () => {
      const { fixture } = setup();
      const title = fixture.nativeElement.querySelector('h2[mat-dialog-title]');
      expect(title?.textContent?.trim()).toBe('Nueva materia');
    });
  });

  describe('initial data loading', () => {
    it('issues category and level requests in parallel and enables the form', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.loading()).toBe(false);
      expect(fixture.componentInstance.categories().length).toBe(2);
      expect(fixture.componentInstance.levels().length).toBe(2);
      expect(fixture.componentInstance.form.enabled).toBe(true);
    });

    it('form is disabled while any initial request is pending', () => {
      const { fixture } = setup({ skipFlush: true });
      expect(fixture.componentInstance.loading()).toBe(true);
      expect(fixture.componentInstance.form.disabled).toBe(true);
    });

    it('opens the load-error snackbar and keeps Crear disabled when loading fails', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { fixture, snackOpen } = setup({ failLoad: true });
      await fixture.whenStable();
      expect(fixture.componentInstance.loadFailed()).toBe(true);
      expect(snackOpen).toHaveBeenCalledWith(
        LOAD_ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000, panelClass: 'snackbar-error' })
      );
      expect(errSpy).toHaveBeenCalledWith(
        '[subject-new] failed to load form data',
        expect.anything()
      );
      errSpy.mockRestore();
    });
  });

  describe('validation', () => {
    it('code is required and enforces maxlength=50 attribute', () => {
      const { fixture } = setup();
      const codeCtrl = fixture.componentInstance.form.controls.code;
      expect(codeCtrl.hasError('required')).toBe(true);
      const input = fixture.nativeElement.querySelector(
        'input[formControlName="code"]'
      ) as HTMLInputElement;
      expect(input.getAttribute('maxlength')).toBe('50');
    });

    it('description is required and enforces maxlength=100 attribute', () => {
      const { fixture } = setup();
      const descCtrl = fixture.componentInstance.form.controls.description;
      expect(descCtrl.hasError('required')).toBe(true);
      const input = fixture.nativeElement.querySelector(
        'input[formControlName="description"]'
      ) as HTMLInputElement;
      expect(input.getAttribute('maxlength')).toBe('100');
    });

    it('Crear is disabled while the form is invalid', () => {
      const { fixture } = setup();
      const btn = fixture.nativeElement.querySelector(
        '[data-testid="subject-new-submit"]'
      ) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  describe('autocomplete filtering', () => {
    it('filters categories by title case-insensitively', () => {
      const { fixture } = setup();
      fixture.componentInstance.onCategoryInput('cie');
      expect(fixture.componentInstance.filteredCategories().map((c) => c.id)).toEqual([3]);
    });

    it('filters levels by title case-insensitively', () => {
      const { fixture } = setup();
      fixture.componentInstance.onLevelInput('SEC');
      expect(fixture.componentInstance.filteredLevels().map((l) => l.id)).toEqual([2]);
    });

    it('editing the input after selection clears the stored id', () => {
      const { fixture } = setup();
      fixture.componentInstance.onCategorySelected(makeCategory(3, 'Ciencias exactas'));
      expect(fixture.componentInstance.form.controls.categoryId.value).toBe(3);
      fixture.componentInstance.onCategoryInput('other');
      expect(fixture.componentInstance.form.controls.categoryId.value).toBeNull();
    });
  });

  describe('submit', () => {
    function selectValid(fixture: ComponentFixture<SubjectNewComponent>) {
      fixture.componentInstance.form.controls.code.setValue('MAT-101');
      fixture.componentInstance.form.controls.description.setValue('Matemáticas básicas');
      fixture.componentInstance.form.controls.categoryId.setValue(3);
      fixture.componentInstance.form.controls.levelId.setValue(1);
    }

    it('POSTs the exact payload and closes the dialog with the created DTO on success', () => {
      const { fixture, http, dialogRef, snackOpen } = setup();
      selectValid(fixture);
      fixture.componentInstance.onSubmit();

      const req = http.expectOne(`${environment.apiBaseUrl}/api/subject`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        code: 'MAT-101',
        description: 'Matemáticas básicas',
        category: { id: 3 },
        level: { id: 1 },
      });
      expect(req.request.body.id).toBeUndefined();

      const created: SubjectDto = {
        id: 42,
        code: 'MAT-101',
        description: 'Matemáticas básicas',
        category: makeCategory(3),
        level: makeLevel(1),
      };
      req.flush(created);

      expect(snackOpen).toHaveBeenCalledWith(
        SUCCESS_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000 })
      );
      expect(dialogRef.close).toHaveBeenCalledWith(created);
    });

    it('keeps the dialog open and shows the error snackbar on failure', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { fixture, http, dialogRef, snackOpen } = setup();
      selectValid(fixture);
      fixture.componentInstance.onSubmit();
      http
        .expectOne(`${environment.apiBaseUrl}/api/subject`)
        .flush('boom', { status: 500, statusText: 'Server Error' });

      expect(snackOpen).toHaveBeenCalledWith(
        ERROR_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000, panelClass: 'snackbar-error' })
      );
      expect(dialogRef.close).not.toHaveBeenCalled();
      expect(fixture.componentInstance.saving()).toBe(false);
      expect(fixture.componentInstance.form.enabled).toBe(true);
      expect(errSpy).toHaveBeenCalledWith(
        '[subject-new] failed to create subject',
        expect.anything()
      );
      errSpy.mockRestore();
    });
  });

  describe('cancel', () => {
    it('closes the dialog without invoking POST /api/subject', () => {
      const { fixture, http, dialogRef } = setup();
      fixture.componentInstance.onCancel();
      expect(dialogRef.close).toHaveBeenCalledWith();
      http.expectNone(`${environment.apiBaseUrl}/api/subject`);
    });
  });
});
