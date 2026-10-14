import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { UserDto } from '@core/models/auth.model';
import { TeacherService } from '@core/services/teacher.service';
import { nonBlankValidator } from '@features/cycles/shared/cycle-form.utils';
import { CreateTeacherRequest } from '@features/teachers/models/create-teacher.request';
import { toBirthDateIso } from '@features/teachers/shared/teacher-form.utils';
import { TEACHER_ROLE_ID } from '@features/teachers/teachers.constants';
import { showSaveError } from '@core/errors/field-errors';

export { toBirthDateIso };

export const SUCCESS_MESSAGE = 'Registro creado exitosamente';
export const ERROR_MESSAGE = 'Error al crear este registro';

@Component({
  selector: 'app-teacher-new',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './teacher-new.component.html',
  styleUrl: './teacher-new.component.scss',
})
export class TeacherNewComponent {
  private readonly fb = inject(FormBuilder);
  private readonly teacherService = inject(TeacherService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(
    MatDialogRef<TeacherNewComponent, UserDto>
  );

  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    username: new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(20),
        nonBlankValidator,
      ],
    }),
    password: new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(20),
      ],
    }),
    name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator],
    }),
    parentLastName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator],
    }),
    motherLastName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator],
    }),
    birthDate: new FormControl<Date | null>(null, {
      validators: [Validators.required],
    }),
    address: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator],
    }),
    church: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator],
    }),
    email: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    phone: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator],
    }),
  });

  onSubmit(): void {
    if (this.form.invalid || this.saving()) return;

    const value = this.form.getRawValue();
    if (!value.birthDate) return;

    const payload: CreateTeacherRequest = {
      username: value.username.trim(),
      password: value.password,
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
      role: { id: TEACHER_ROLE_ID },
    };

    this.saving.set(true);
    this.form.disable();

    this.teacherService
      .create(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dto) => {
          this.snackBar.open(SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
          this.dialogRef.close(dto);
        },
        error: (err: unknown) => {
          console.error('[teacher-new] failed to create teacher', err);
          this.saving.set(false);
          this.form.enable();
          showSaveError(this.form, err, ERROR_MESSAGE, this.snackBar);
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
