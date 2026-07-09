import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { CycleRow } from '../cycle-list/cycle-list.component';
import {
  CONFIRM_MESSAGE,
  CONFIRM_TITLE,
  CycleDeleteConfirmComponent,
} from './cycle-delete-confirm.component';

describe('CycleDeleteConfirmComponent', () => {
  let fixture: ComponentFixture<CycleDeleteConfirmComponent>;
  let component: CycleDeleteConfirmComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const row: CycleRow = {
    id: 7,
    description: '2026-I',
    startDate: '2026-01-15T00:00:00Z',
    endDate: '2026-06-15T00:00:00Z',
    principalName: 'Ana Perez',
    current: true,
    raw: {} as CycleRow['raw'],
  };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [CycleDeleteConfirmComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { row } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CycleDeleteConfirmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders title and message constants', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent).toContain(CONFIRM_TITLE);
    expect(el.textContent).toContain(CONFIRM_MESSAGE);
  });

  it('renders summary composed from injected row', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('7 · 2026-I ·');
    expect(component.summary).toMatch(/^7 · 2026-I · .+–.+$/);
  });

  it('Cancelar closes with false', () => {
    component.onCancel();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });

  it('Eliminar closes with true', () => {
    component.onConfirm();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});
