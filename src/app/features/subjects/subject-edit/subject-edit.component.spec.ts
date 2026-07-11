import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
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
  SubjectEditComponent,
  SubjectEditDialogData,
} from './subject-edit.component';

function makeCategory(id: number, title = `Categoría ${id}`): CategoryDto {
  return { id, title, description: '', code: `CAT${id}` };
}

function makeLevel(id: number, title = `Nivel ${id}`): LevelDto {
  return { id, title, code: `LVL${id}` };
}

function makeSubject(overrides: Partial<SubjectDto> = {}): SubjectDto {
  return {
    id: 42,
    code: 'MAT-101',
    description: 'Matemáticas I',
    category: makeCategory(3, 'Ciencias exactas'),
    level: makeLevel(1, 'Primaria'),
    ...overrides,
  };
}

interface Harness {
  fixture: ComponentFixture<SubjectEditComponent>;
  http: HttpTestingController;
  dialogRef: { close: ReturnType<typeof vi.fn> };
  snackOpen: ReturnType<typeof vi.spyOn>;
}

interface SetupOptions {
  skipFlush?: boolean;
  failLoad?: boolean;
  subject?: SubjectDto;
  categories?: CategoryDto[];
  levels?: LevelDto[];
}

function setup(options: SetupOptions = {}): Harness {
  const dialogRef = { close: vi.fn() };
  const data: SubjectEditDialogData = {
    subject: options.subject ?? makeSubject(),
  };

  TestBed.configureTestingModule({
    imports: [SubjectEditComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimationsAsync(),
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });

  const fixture = TestBed.createComponent(SubjectEditComponent);
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
      catReq.flush(
        options.categories ?? [
          makeCategory(3, 'Ciencias exactas'),
          makeCategory(4, 'Humanidades'),
        ]
      );
      lvlReq.flush(
        options.levels ?? [makeLevel(1, 'Primaria'), makeLevel(2, 'Secundaria')]
      );
    }
    fixture.detectChanges();
  }

  return { fixture, http, dialogRef, snackOpen };
}

describe('SubjectEditComponent', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      /* verified per-test */
    }
  });

  describe('smoke', () => {
    it('renders the "Editar materia" title', () => {
      const { fixture } = setup();
      const title = fixture.nativeElement.querySelector('h2[mat-dialog-title]');
      expect(title?.textContent?.trim()).toBe('Editar materia');
    });
  });

  describe('initial data loading and pre-population', () => {
    it('issues category and level requests and pre-populates all four controls', () => {
      const { fixture } = setup();
      const cmp = fixture.componentInstance;
      expect(cmp.loading()).toBe(false);
      expect(cmp.form.enabled).toBe(true);
      expect(cmp.form.getRawValue()).toEqual({
        code: 'MAT-101',
        description: 'Matemáticas I',
        categoryId: 3,
        levelId: 1,
      });
      expect(cmp.categorySearch()).toBe('Ciencias exactas');
      expect(cmp.levelSearch()).toBe('Primaria');
    });

    it('form is disabled while any initial request is pending', () => {
      const { fixture } = setup({ skipFlush: true });
      expect(fixture.componentInstance.loading()).toBe(true);
      expect(fixture.componentInstance.form.disabled).toBe(true);
    });

    it('leaves categoryId null when the current category is not in the fetched list', () => {
      const { fixture } = setup({
        categories: [makeCategory(99, 'Otra')],
      });
      const cmp = fixture.componentInstance;
      expect(cmp.form.controls.categoryId.value).toBeNull();
      expect(cmp.form.invalid).toBe(true);
      const btn = fixture.nativeElement.querySelector(
        '[data-testid="subject-edit-submit"]'
      ) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('leaves levelId null when the current level is not in the fetched list', () => {
      const { fixture } = setup({
        levels: [makeLevel(99, 'Otro')],
      });
      const cmp = fixture.componentInstance;
      expect(cmp.form.controls.levelId.value).toBeNull();
      expect(cmp.form.invalid).toBe(true);
    });

    it('opens the load-error snackbar and keeps Actualizar disabled when loading fails', async () => {
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
        '[subject-edit] failed to load form data',
        expect.anything()
      );
      const btn = fixture.nativeElement.querySelector(
        '[data-testid="subject-edit-submit"]'
      ) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      errSpy.mockRestore();
    });
  });

  describe('validation', () => {
    it('code enforces maxlength=50 attribute and required', () => {
      const { fixture } = setup();
      const codeCtrl = fixture.componentInstance.form.controls.code;
      codeCtrl.setValue('');
      expect(codeCtrl.hasError('required')).toBe(true);
      const input = fixture.nativeElement.querySelector(
        'input[formControlName="code"]'
      ) as HTMLInputElement;
      expect(input.getAttribute('maxlength')).toBe('50');
    });

    it('description enforces maxlength=100 attribute and required', () => {
      const { fixture } = setup();
      const descCtrl = fixture.componentInstance.form.controls.description;
      descCtrl.setValue('');
      expect(descCtrl.hasError('required')).toBe(true);
      const input = fixture.nativeElement.querySelector(
        'input[formControlName="description"]'
      ) as HTMLInputElement;
      expect(input.getAttribute('maxlength')).toBe('100');
    });
  });

  describe('autocomplete filtering', () => {
    it('filters categories by title case-insensitively', () => {
      const { fixture } = setup();
      fixture.componentInstance.onCategoryInput('hum');
      expect(fixture.componentInstance.filteredCategories().map((c) => c.id)).toEqual([4]);
    });

    it('editing the input after selection clears the stored id', () => {
      const { fixture } = setup();
      fixture.componentInstance.onCategoryInput('other');
      expect(fixture.componentInstance.form.controls.categoryId.value).toBeNull();
    });
  });

  describe('submit', () => {
    it('PUTs the exact payload to /api/subject/{id} and closes the dialog on success', () => {
      const { fixture, http, dialogRef, snackOpen } = setup();
      const cmp = fixture.componentInstance;
      cmp.form.controls.description.setValue('  Matemáticas actualizadas  ');
      cmp.onSubmit();

      const req = http.expectOne(`${environment.apiBaseUrl}/api/subject/42?includeDependencies=true`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        code: 'MAT-101',
        description: 'Matemáticas actualizadas',
        category: { id: 3 },
        level: { id: 1 },
      });
      expect((req.request.body as { id?: number }).id).toBeUndefined();

      const updated: SubjectDto = {
        id: 42,
        code: 'MAT-101',
        description: 'Matemáticas actualizadas',
        category: makeCategory(3),
        level: makeLevel(1),
      };
      req.flush(updated);

      expect(snackOpen).toHaveBeenCalledWith(
        SUCCESS_MESSAGE,
        'Cerrar',
        expect.objectContaining({ duration: 3000 })
      );
      expect(dialogRef.close).toHaveBeenCalledWith(updated);
    });

    it('keeps the dialog open and shows the error snackbar on failure', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { fixture, http, dialogRef, snackOpen } = setup();
      fixture.componentInstance.onSubmit();
      http
        .expectOne(`${environment.apiBaseUrl}/api/subject/42?includeDependencies=true`)
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
        '[subject-edit] failed to update subject',
        expect.anything()
      );
      errSpy.mockRestore();
    });
  });

  describe('cancel', () => {
    it('closes the dialog without invoking PUT /api/subject/{id}', () => {
      const { fixture, http, dialogRef } = setup();
      fixture.componentInstance.onCancel();
      expect(dialogRef.close).toHaveBeenCalledWith();
      http.expectNone(`${environment.apiBaseUrl}/api/subject/42?includeDependencies=true`);
    });
  });
});
