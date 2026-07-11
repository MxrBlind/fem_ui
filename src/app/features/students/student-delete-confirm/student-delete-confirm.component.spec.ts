import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { STUDENT_FALLBACK, StudentRow } from '../student-list/student-list.component';
import {
  CONFIRM_MESSAGE,
  CONFIRM_TITLE,
  StudentDeleteConfirmComponent,
} from './student-delete-confirm.component';

function makeRow(overrides: Partial<StudentRow> = {}): StudentRow {
  return {
    id: 42,
    name: 'Juan',
    parentLastName: 'Perez',
    motherLastName: 'Garcia',
    email: 'jp@example.com',
    phone: '5551234567',
    church: 'Central',
    raw: {} as StudentRow['raw'],
    ...overrides,
  };
}

async function render(row: StudentRow): Promise<{
  fixture: ComponentFixture<StudentDeleteConfirmComponent>;
  component: StudentDeleteConfirmComponent;
  dialogRef: { close: ReturnType<typeof vi.fn> };
}> {
  const dialogRef = { close: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [StudentDeleteConfirmComponent],
    providers: [
      provideAnimationsAsync(),
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: { row } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(StudentDeleteConfirmComponent);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, component, dialogRef };
}

describe('StudentDeleteConfirmComponent', () => {
  it('renders title and message constants', async () => {
    const { fixture } = await render(makeRow());
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent).toContain(CONFIRM_TITLE);
    expect(el.textContent).toContain(CONFIRM_MESSAGE);
  });

  it('renders summary composed from injected row', async () => {
    const { fixture, component } = await render(makeRow());
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('42 · Juan Perez · jp@example.com');
    expect(component.summary).toBe('42 · Juan Perez · jp@example.com');
  });

  it('omits em-dash segments from the summary', async () => {
    const { component } = await render(
      makeRow({
        name: STUDENT_FALLBACK,
        parentLastName: STUDENT_FALLBACK,
        email: STUDENT_FALLBACK,
      })
    );
    expect(component.summary).toBe('42');
  });

  it('keeps partial name when only one of the name fields is missing', async () => {
    const { component } = await render(
      makeRow({ parentLastName: STUDENT_FALLBACK })
    );
    expect(component.summary).toBe('42 · Juan · jp@example.com');
  });

  it('Cancelar closes with false', async () => {
    const { component, dialogRef } = await render(makeRow());
    component.onCancel();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });

  it('Eliminar closes with true', async () => {
    const { component, dialogRef } = await render(makeRow());
    component.onConfirm();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});
