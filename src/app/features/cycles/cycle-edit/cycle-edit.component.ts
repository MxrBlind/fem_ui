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
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { UserDto } from '@core/models/auth.model';
import { CycleService } from '@core/services/cycle.service';
import { UserService } from '@core/services/user.service';
import {
  CycleDto,
  UpdateCycleRequest,
} from '@features/enrollments/models/cycle.model';
import {
  END_BEFORE_START_MESSAGE,
  endAfterStartValidator,
  nonBlankValidator,
  parseIsoDate,
  toIsoDateString,
} from '../shared/cycle-form.utils';

export const SUCCESS_MESSAGE = 'Registro actualizado exitosamente';
export const ERROR_MESSAGE = 'Error al actualizar este registro';
export const LOAD_ERROR_MESSAGE =
  'No se pudieron cargar los datos del formulario';

export interface CycleEditDialogData {
  cycle: CycleDto;
}

@Component({
  selector: 'app-cycle-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCheckboxModule,
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
  templateUrl: './cycle-edit.component.html',
  styleUrl: './cycle-edit.component.scss',
})
export class CycleEditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly cycleService = inject(CycleService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(
    MatDialogRef<CycleEditComponent, CycleDto>
  );
  private readonly data = inject<CycleEditDialogData>(MAT_DIALOG_DATA);

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
      description: new FormControl<string>(this.data.cycle.description ?? '', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.maxLength(50),
          nonBlankValidator,
        ],
      }),
      startDate: new FormControl<Date | null>(
        parseIsoDate(this.data.cycle.startDate),
        { validators: [Validators.required] }
      ),
      endDate: new FormControl<Date | null>(
        parseIsoDate(this.data.cycle.endDate),
        { validators: [Validators.required] }
      ),
      current: new FormControl<boolean>(this.data.cycle.current ?? false, {
        nonNullable: true,
      }),
      principalId: new FormControl<number | null>(
        this.data.cycle.principal?.id ?? null,
        { validators: [Validators.required] }
      ),
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
          const principalId = this.form.controls.principalId.value;
          if (principalId != null) {
            const selected = teachers.find((u) => u.id === principalId);
            if (selected) {
              this.principalSearch.set(this.displayTeacher(selected));
            }
          }
          this.loading.set(false);
          this.form.enable();
        },
        error: (err: unknown) => {
          console.error('[cycle-edit] failed to load form data', err);
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

    const cycleId = this.data.cycle.id;
    if (cycleId == null) return;

    const { description, startDate, endDate, current, principalId } =
      this.form.getRawValue();
    if (!startDate || !endDate || principalId == null) return;

    const payload: UpdateCycleRequest = {
      description: description.trim(),
      startDate: toIsoDateString(startDate),
      endDate: toIsoDateString(endDate),
      principal: { id: principalId },
      current,
    };

    this.saving.set(true);
    this.form.disable();

    this.cycleService
      .update(cycleId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dto) => {
          this.snackBar.open(SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
          this.dialogRef.close(dto);
        },
        error: (err: unknown) => {
          console.error('[cycle-edit] failed to update cycle', err);
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
