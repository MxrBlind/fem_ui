import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { SUBJECT_FALLBACK, SubjectRow } from '../subject-list/subject-list.component';
import {
  CONFIRM_MESSAGE,
  CONFIRM_TITLE,
  SubjectDeleteConfirmComponent,
  SubjectDeleteConfirmData,
} from './subject-delete-confirm.component';

function makeRow(overrides: Partial<SubjectRow> = {}): SubjectRow {
  return {
    id: 42,
    code: 'MAT-101',
    description: 'Matemáticas I',
    category: 'Ciencias exactas',
    level: 'Primaria',
    raw: {
      id: 42,
      code: 'MAT-101',
      description: 'Matemáticas I',
      category: { id: 3, title: 'Ciencias exactas', description: '', code: 'CIE' },
      level: { id: 1, title: 'Primaria' },
    },
    ...overrides,
  };
}

interface Harness {
  fixture: ComponentFixture<SubjectDeleteConfirmComponent>;
  dialogRef: { close: ReturnType<typeof vi.fn> };
}

function setup(row: SubjectRow = makeRow()): Harness {
  const dialogRef = { close: vi.fn() };
  const data: SubjectDeleteConfirmData = { row };

  TestBed.configureTestingModule({
    imports: [SubjectDeleteConfirmComponent],
    providers: [
      provideAnimationsAsync(),
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });

  const fixture = TestBed.createComponent(SubjectDeleteConfirmComponent);
  fixture.detectChanges();
  return { fixture, dialogRef };
}

describe('SubjectDeleteConfirmComponent', () => {
  describe('smoke', () => {
    it('renders the title and confirmation message', () => {
      const { fixture } = setup();
      const title = fixture.nativeElement.querySelector('h2[mat-dialog-title]');
      expect(title?.textContent?.trim()).toBe(CONFIRM_TITLE);
      const message = fixture.nativeElement.querySelector('.mat-body-large');
      expect(message?.textContent?.trim()).toBe(CONFIRM_MESSAGE);
    });
  });

  describe('summary', () => {
    it('renders "{id} · {code} · {description}" for a fully populated row', () => {
      const { fixture } = setup();
      expect(fixture.componentInstance.summary).toBe('42 · MAT-101 · Matemáticas I');
    });

    it('skips segments equal to SUBJECT_FALLBACK and blank strings', () => {
      const { fixture } = setup(
        makeRow({ code: SUBJECT_FALLBACK, description: '   ' })
      );
      expect(fixture.componentInstance.summary).toBe('42');
    });
  });

  describe('actions', () => {
    it('Cancelar closes the dialog with false', () => {
      const { fixture, dialogRef } = setup();
      fixture.componentInstance.onCancel();
      expect(dialogRef.close).toHaveBeenCalledWith(false);
    });

    it('Eliminar closes the dialog with true', () => {
      const { fixture, dialogRef } = setup();
      fixture.componentInstance.onConfirm();
      expect(dialogRef.close).toHaveBeenCalledWith(true);
    });
  });
});
