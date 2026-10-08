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
import { catchError, of } from 'rxjs';

import { UserDto } from '@core/models/auth.model';
import { LevelService } from '@core/services/level.service';
import { StudentService } from '@core/services/student.service';
import {
  nonBlankValidator,
  parseIsoDate,
} from '@features/cycles/shared/cycle-form.utils';
import { LevelDto } from '@features/enrollments/models/enrollment.model';
import {
  STUDENT_ROLE_ID,
  UpdateStudentRequest,
} from '@features/students/models/update-student.request';
import {
  optionalLengthValidator,
  toBirthDateIso,
} from '@features/teachers/shared/teacher-form.utils';

export const SUCCESS_MESSAGE = 'Registro actualizado exitosamente';
export const ERROR_MESSAGE = 'Error al actualizar este registro';
export const LOAD_ERROR_MESSAGE = 'No se pudieron cargar los datos del formulario';

export interface StudentEditDialogData {
  user: UserDto;
}

@Component({
  selector: 'app-student-edit',
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
  templateUrl: './student-edit.component.html',
  styleUrl: './student-edit.component.scss',
})
export class StudentEditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly studentService = inject(StudentService);
  private readonly levelService = inject(LevelService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(
    MatDialogRef<StudentEditComponent, UserDto>
  );
  private readonly data = inject<StudentEditDialogData>(MAT_DIALOG_DATA);

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);

  readonly levels = signal<LevelDto[]>([]);
  readonly levelSearch = signal('');

  readonly filteredLevels = computed(() => {
    const q = this.levelSearch().trim().toLowerCase();
    const list = this.levels();
    if (!q) return list;
    return list.filter((l) => this.displayLevel(l).toLowerCase().includes(q));
  });

  readonly form = this.fb.nonNullable.group({
    username: new FormControl<string>(
      { value: this.data.user.username, disabled: true },
      { nonNullable: true }
    ),
    password: new FormControl<string>('', {
      nonNullable: true,
      validators: [optionalLengthValidator(8, 20)],
    }),
    name: new FormControl<string>(this.data.user.profile?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator],
    }),
    parentLastName: new FormControl<string>(
      this.data.user.profile?.parentLastName ?? '',
      {
        nonNullable: true,
        validators: [Validators.required, nonBlankValidator],
      }
    ),
    motherLastName: new FormControl<string>(
      this.data.user.profile?.motherLastName ?? '',
      {
        nonNullable: true,
        validators: [Validators.required, nonBlankValidator],
      }
    ),
    levelId: new FormControl<number | null>(this.data.user.level?.id ?? null, {
      validators: [Validators.required],
    }),
    birthDate: new FormControl<Date | null>(
      parseIsoDate(this.data.user.profile?.birthDate),
      { validators: [Validators.required] }
    ),
    address: new FormControl<string>(this.data.user.profile?.address ?? '', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator],
    }),
    church: new FormControl<string>(this.data.user.profile?.church ?? '', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator],
    }),
    email: new FormControl<string>(this.data.user.profile?.email ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    phone: new FormControl<string>(this.data.user.profile?.phone ?? '', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator],
    }),
  });

  // Visible text of the level autocomplete. It lives outside the form group so the group keeps
  // exactly the payload controls, but it gives mat-form-field a control to derive its error state from.
  readonly levelText = new FormControl<string | LevelDto>(
    this.data.user.level?.title ?? '',
    {
      nonNullable: true,
      validators: [() => (this.form.controls.levelId.value == null ? { required: true } : null)],
    }
  );

  ngOnInit(): void {
    this.setFormEnabled(false);
    this.levelService
      .list()
      .pipe(
        catchError((err: unknown) => {
          console.error('[student-edit] failed to load form data', err);
          this.loadFailed.set(true);
          this.snackBar.open(LOAD_ERROR_MESSAGE, 'Cerrar', {
            duration: 3000,
            panelClass: 'snackbar-error',
          });
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((levels: LevelDto[] | null) => {
        this.loading.set(false);
        if (!levels) return;
        this.levels.set(levels);
        this.setFormEnabled(true);
      });
  }

  displayLevel(lvl: LevelDto | string | null | undefined): string {
    return typeof lvl === 'string' ? lvl : (lvl?.title ?? '');
  }

  onLevelInput(value: string): void {
    this.levelSearch.set(value);
    const currentId = this.form.controls.levelId.value;
    if (currentId != null) {
      const selected = this.levels().find((l) => l.id === currentId);
      const selectedTitle = selected
        ? this.displayLevel(selected)
        : (this.data.user.level?.title ?? '');
      if (selectedTitle !== value) {
        this.form.controls.levelId.setValue(null);
      }
    }
    this.levelText.updateValueAndValidity();
  }

  onLevelSelected(lvl: LevelDto): void {
    if (lvl.id == null) return;
    this.form.controls.levelId.setValue(lvl.id);
    this.levelSearch.set(this.displayLevel(lvl));
    this.levelText.setValue(this.displayLevel(lvl));
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving() || this.loading() || this.loadFailed()) {
      return;
    }

    const id = this.data.user.id;
    if (id == null) return;

    const value = this.form.getRawValue();
    if (!value.birthDate || value.levelId == null) return;

    const trimmedPassword = value.password.trim();

    const payload: UpdateStudentRequest = {
      username: value.username.trim(),
      role: { id: STUDENT_ROLE_ID },
      level: { id: value.levelId },
      profile: {
        name: value.name.trim(),
        parentLastName: value.parentLastName.trim(),
        motherLastName: value.motherLastName.trim(),
        birthDate: toBirthDateIso(value.birthDate),
        address: value.address.trim(),
        church: value.church.trim(),
        email: value.email.trim(),
        phone: value.phone.trim(),
      },
    };
    if (trimmedPassword.length > 0) {
      payload.password = trimmedPassword;
    }

    this.saving.set(true);
    this.setFormEnabled(false);

    this.studentService
      .update(id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dto) => {
          this.snackBar.open(SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
          this.dialogRef.close(dto);
        },
        error: (err: unknown) => {
          console.error('[student-edit] failed to update student', err);
          this.snackBar.open(ERROR_MESSAGE, 'Cerrar', {
            duration: 3000,
            panelClass: 'snackbar-error',
          });
          this.saving.set(false);
          this.setFormEnabled(true);
        },
      });
  }

  // The username is read-only, so it stays disabled whenever the rest of the form is enabled.
  private setFormEnabled(enabled: boolean): void {
    if (enabled) {
      this.form.enable();
      this.levelText.enable();
      this.form.controls.username.disable({ emitEvent: false });
    } else {
      this.form.disable();
      this.levelText.disable();
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
