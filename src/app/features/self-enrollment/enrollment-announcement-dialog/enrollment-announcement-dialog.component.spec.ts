import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';

import { CycleDto } from '@features/enrollments/models/cycle.model';
import {
  ANNOUNCEMENT_TITLE,
  CLOSE_LABEL,
  DONT_SHOW_AGAIN_LABEL,
  EnrollmentAnnouncementDialogComponent,
  buildAnnouncementMessage,
} from './enrollment-announcement-dialog.component';

describe('EnrollmentAnnouncementDialogComponent', () => {
  let fixture: ComponentFixture<EnrollmentAnnouncementDialogComponent>;
  let el: HTMLElement;
  let backdropClick$: Subject<MouseEvent>;
  let keydown$: Subject<KeyboardEvent>;
  let dialogRef: {
    close: ReturnType<typeof vi.fn>;
    backdropClick: () => Subject<MouseEvent>;
    keydownEvents: () => Subject<KeyboardEvent>;
  };

  const cycle: CycleDto = {
    id: 10,
    description: '2026-B',
    startDate: '2026-07-01T00:00:00Z',
    endDate: '2026-12-15T00:00:00Z',
    current: true,
    openForEnrollment: true,
  };

  beforeEach(async () => {
    backdropClick$ = new Subject<MouseEvent>();
    keydown$ = new Subject<KeyboardEvent>();
    dialogRef = {
      close: vi.fn(),
      backdropClick: () => backdropClick$,
      keydownEvents: () => keydown$,
    };
    await TestBed.configureTestingModule({
      imports: [EnrollmentAnnouncementDialogComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { cycle } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EnrollmentAnnouncementDialogComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  function checkbox(): HTMLInputElement {
    return el.querySelector(
      '[data-testid="enrollment-announcement-dont-show"] input[type="checkbox"]'
    ) as HTMLInputElement;
  }

  function closeButton(): HTMLButtonElement {
    return el.querySelector('[data-testid="enrollment-announcement-close"]') as HTMLButtonElement;
  }

  function toggleCheckbox(): void {
    checkbox().click();
    fixture.detectChanges();
  }

  it('builds the announcement message with the cycle description', () => {
    expect(buildAnnouncementMessage('2026-B')).toBe(
      "El ciclo 2026-B está abierto para inscripciones. Utiliza la opción del menú 'Preinscripciones' para seleccionar tus siguientes materias"
    );
  });

  it('renders the title and the message for the injected cycle', () => {
    expect(el.querySelector('h2')?.textContent).toContain(ANNOUNCEMENT_TITLE);
    expect(ANNOUNCEMENT_TITLE).toBe('Inscripciones abiertas');
    expect(
      el.querySelector('[data-testid="enrollment-announcement-message"]')?.textContent?.trim()
    ).toBe(buildAnnouncementMessage('2026-B'));
  });

  it('renders an unchecked "No volver a mostrar" checkbox before the "Cerrar" button in the actions', () => {
    const actions = el.querySelector('mat-dialog-actions') as HTMLElement;
    const dontShow = actions.querySelector('[data-testid="enrollment-announcement-dont-show"]');
    const close = actions.querySelector('[data-testid="enrollment-announcement-close"]');
    expect(dontShow?.textContent).toContain(DONT_SHOW_AGAIN_LABEL);
    expect(DONT_SHOW_AGAIN_LABEL).toBe('No volver a mostrar');
    expect(close?.textContent).toContain(CLOSE_LABEL);
    expect(CLOSE_LABEL).toBe('Cerrar');
    expect(checkbox().checked).toBe(false);
    // Checkbox first (bottom-left), button second (bottom-right).
    expect(dontShow!.compareDocumentPosition(close!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('"Cerrar" closes with dontShowAgain false by default', () => {
    closeButton().click();
    expect(dialogRef.close).toHaveBeenCalledWith({ dontShowAgain: false });
  });

  it('"Cerrar" closes with dontShowAgain true after checking the box', () => {
    toggleCheckbox();
    closeButton().click();
    expect(dialogRef.close).toHaveBeenCalledWith({ dontShowAgain: true });
  });

  it('backdrop click closes with the current checkbox value', () => {
    toggleCheckbox();
    backdropClick$.next(new MouseEvent('click'));
    expect(dialogRef.close).toHaveBeenCalledWith({ dontShowAgain: true });
  });

  it('Escape closes with the current checkbox value', () => {
    keydown$.next(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dialogRef.close).toHaveBeenCalledWith({ dontShowAgain: false });
  });

  it('ignores other keys and Escape events whose default was prevented', () => {
    keydown$.next(new KeyboardEvent('keydown', { key: 'Enter' }));
    const prevented = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    prevented.preventDefault();
    keydown$.next(prevented);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
