import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { EnrollmentRow } from '../models/enrollment.model';
import {
  CONFIRM_MESSAGE,
  CONFIRM_TITLE,
  EnrollmentDeleteConfirmComponent,
} from './enrollment-delete-confirm.component';

describe('EnrollmentDeleteConfirmComponent', () => {
  let fixture: ComponentFixture<EnrollmentDeleteConfirmComponent>;
  let component: EnrollmentDeleteConfirmComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const row: EnrollmentRow = {
    id: 7,
    fullName: 'Ana Pérez Ruiz',
    church: 'Bethel',
    subject: 'Matemáticas I',
    category: 'Núcleo',
    grade: 85,
    raw: {} as EnrollmentRow['raw'],
  };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [EnrollmentDeleteConfirmComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { row } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EnrollmentDeleteConfirmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders title, message and row summary', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent).toContain(CONFIRM_TITLE);
    expect(el.textContent).toContain(CONFIRM_MESSAGE);
    expect(el.textContent).toContain('Ana Pérez Ruiz · Matemáticas I · Núcleo');
  });

  it('Cancelar closes with false', () => {
    component.onCancel();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });

  it('Eliminar closes with true', () => {
    component.onConfirm();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('omits empty summary parts', () => {
    (component.data as { row: EnrollmentRow }).row = { ...row, category: '' };
    expect(component.summary).toBe('Ana Pérez Ruiz · Matemáticas I');
  });
});
