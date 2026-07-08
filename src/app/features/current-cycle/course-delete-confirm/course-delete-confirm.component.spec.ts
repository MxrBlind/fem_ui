import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { CourseRow } from '@features/enrollments/models/enrollment.model';
import {
  CONFIRM_MESSAGE,
  CONFIRM_TITLE,
  CourseDeleteConfirmComponent,
} from './course-delete-confirm.component';

describe('CourseDeleteConfirmComponent', () => {
  let fixture: ComponentFixture<CourseDeleteConfirmComponent>;
  let component: CourseDeleteConfirmComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const row: CourseRow = {
    id: 9,
    subjectDescription: 'Matemáticas I',
    credits: 4,
    teacherFullName: 'Ana Pérez Ruiz',
    categoryTitle: 'Núcleo',
    levelTitle: 'Básico',
    raw: {} as CourseRow['raw'],
  };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [CourseDeleteConfirmComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { row } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CourseDeleteConfirmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders title, message and row summary', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent).toContain(CONFIRM_TITLE);
    expect(el.textContent).toContain(CONFIRM_MESSAGE);
    expect(el.textContent).toContain('Matemáticas I · Ana Pérez Ruiz · Núcleo');
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
    (component.data as { row: CourseRow }).row = { ...row, categoryTitle: '' };
    expect(component.summary).toBe('Matemáticas I · Ana Pérez Ruiz');
  });
});
