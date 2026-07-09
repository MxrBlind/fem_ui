import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { UserDto } from '@core/models/auth.model';
import { CycleService } from '@core/services/cycle.service';
import { UserService } from '@core/services/user.service';
import {
  CreateCycleRequest,
  CycleDto,
} from '@features/enrollments/models/cycle.model';

export const SUCCESS_MESSAGE = 'Registro creado exitosamente';
export const ERROR_MESSAGE = 'Error al crear este registro';
export const LOAD_ERROR_MESSAGE =
  'No se pudieron cargar los datos del formulario';
export const END_BEFORE_START_MESSAGE =
  'La fecha de término debe ser posterior a la fecha de inicio';

export function endAfterStartValidator(
  group: AbstractControl
): ValidationErrors | null {
  const start = group.get('startDate')?.value as Date | null;
  const end = group.get('endDate')?.value as Date | null;
  if (!start || !end) return null;
  return end.getTime() > start.getTime() ? null : { endBeforeStart: true };
}

export function toIsoDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-cycle-new',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './cycle-new.component.html',
  styleUrl: './cycle-new.component.scss',
})
export class CycleNewComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly cycleService = inject(CycleService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(
    MatDialogRef<CycleNewComponent, CycleDto>
  );

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);

  readonly teachers = signal<UserDto[]>([]);
  readonly principalSearch = signal('');

  readonly endBeforeStartMessage = END_BEFORE_START_MESSAGE;

  readonly filteredTeachers = computed(() => {
    const q = this.principalSearch().trim().toLowerCase();
    const list = this.teachers();
    if (!q) return list;
    return list.filter((u) => this.displayTeacher(u).toLowerCase().includes(q));
  });

  readonly form = this.fb.nonNullable.group(
    {
      description: new FormControl<string>('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.maxLength(50),
          nonBlankValidator,
        ],
      }),
      startDate: new FormControl<Date | null>(null, {
        validators: [Validators.required],
      }),
      endDate: new FormControl<Date | null>(null, {
        validators: [Validators.required],
      }),
      principalId: new FormControl<number | null>(null, {
        validators: [Validators.required],
      }),
    },
    { validators: [endAfterStartValidator] }
  );

  ngOnInit(): void {
    this.form.disable();
    this.userService
      .listByRole('ROLE_TEACHER')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (teachers) => {
          this.teachers.set(teachers);
          this.loading.set(false);
          this.form.enable();
        },
        error: (err: unknown) => {
          console.error('[cycle-new] failed to load form data', err);
          this.loadFailed.set(true);
          this.loading.set(false);
          this.snackBar.open(LOAD_ERROR_MESSAGE, 'Cerrar', {
            duration: 3000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  displayTeacher(user: UserDto | null | undefined): string {
    if (!user) return '';
    const profile = user.profile;
    const first = (profile?.name ?? '').trim();
    const last = (profile?.parentLastName ?? '').trim();
    const label = [first, last].filter((p) => p.length > 0).join(' ');
    return label.length > 0 ? label : user.username;
  }

  displayTeacherById = (id: number | null): string => {
    if (id == null) return '';
    const user = this.teachers().find((u) => u.id === id);
    return user ? this.displayTeacher(user) : '';
  };

  onPrincipalInput(value: string): void {
    this.principalSearch.set(value);
    if (this.form.controls.principalId.value != null) {
      const selected = this.teachers().find(
        (u) => u.id === this.form.controls.principalId.value
      );
      if (!selected || this.displayTeacher(selected) !== value) {
        this.form.controls.principalId.setValue(null);
      }
    }
  }

  onPrincipalSelected(user: UserDto): void {
    if (user.id == null) return;
    this.form.controls.principalId.setValue(user.id);
    this.principalSearch.set(this.displayTeacher(user));
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving() || this.loadFailed()) return;

    const { description, startDate, endDate, principalId } =
      this.form.getRawValue();
    if (!startDate || !endDate || principalId == null) return;

    const payload: CreateCycleRequest = {
      description: description.trim(),
      startDate: toIsoDateString(startDate),
      endDate: toIsoDateString(endDate),
      principal: { id: principalId },
    };

    this.saving.set(true);
    this.form.disable();

    this.cycleService
      .create(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dto) => {
          this.snackBar.open(SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
          this.dialogRef.close(dto);
        },
        error: (err: unknown) => {
          console.error('[cycle-new] failed to create cycle', err);
          this.snackBar.open(ERROR_MESSAGE, 'Cerrar', {
            duration: 3000,
            panelClass: 'snackbar-error',
          });
          this.saving.set(false);
          this.form.enable();
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

function nonBlankValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value ?? '') as string;
  if (value.length === 0) return null;
  return value.trim().length > 0 ? null : { required: true };
}
