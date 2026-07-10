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
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { UserDto } from '@core/models/auth.model';
import { TeacherService } from '@core/services/teacher.service';
import {
  nonBlankValidator,
  parseIsoDate,
} from '@features/cycles/shared/cycle-form.utils';
import { UpdateTeacherRequest } from '@features/teachers/models/update-teacher.request';
import {
  optionalLengthValidator,
  toBirthDateIso,
} from '@features/teachers/shared/teacher-form.utils';

export const SUCCESS_MESSAGE = 'Registro actualizado exitosamente';
export const ERROR_MESSAGE = 'Error al actualizar este registro';

export interface TeacherEditDialogData {
  user: UserDto;
}

@Component({
  selector: 'app-teacher-edit',
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
  templateUrl: './teacher-edit.component.html',
  styleUrl: './teacher-edit.component.scss',
})
export class TeacherEditComponent {
  private readonly fb = inject(FormBuilder);
  private readonly teacherService = inject(TeacherService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(
    MatDialogRef<TeacherEditComponent, UserDto>
  );
  private readonly data = inject<TeacherEditDialogData>(MAT_DIALOG_DATA);

  readonly saving = signal(false);

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

  onSubmit(): void {
    if (this.form.invalid || this.saving()) return;

    const id = this.data.user.id;
    if (id == null) return;

    const value = this.form.getRawValue();
    if (!value.birthDate) return;

    const trimmedPassword = value.password.trim();

    const payload: UpdateTeacherRequest = {
      username: value.username.trim(),
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
    this.form.disable();

    this.teacherService
      .update(id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dto) => {
          this.snackBar.open(SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
          this.dialogRef.close(dto);
        },
        error: (err: unknown) => {
          console.error('[teacher-edit] failed to update teacher', err);
          this.snackBar.open(ERROR_MESSAGE, 'Cerrar', {
            duration: 3000,
            panelClass: 'snackbar-error',
          });
          this.saving.set(false);
          this.form.enable();
          this.form.controls.username.disable({ emitEvent: false });
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
