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
import { StudentService } from '@core/services/student.service';
import { CreateStudentRequest } from '@features/students/models/create-student.request';
import {
  nonBlankValidator,
  toBirthDateIso,
} from '@features/students/shared/student-form.utils';
import { STUDENT_ROLE_ID } from '@features/students/students.constants';

export { toBirthDateIso };

export const SUCCESS_MESSAGE = 'Registro creado exitosamente';
export const ERROR_MESSAGE = 'Error al crear este registro';

@Component({
  selector: 'app-student-new',
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
  templateUrl: './student-new.component.html',
  styleUrl: './student-new.component.scss',
})
export class StudentNewComponent {
  private readonly fb = inject(FormBuilder);
  private readonly studentService = inject(StudentService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(
    MatDialogRef<StudentNewComponent, UserDto>
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

    const payload: CreateStudentRequest = {
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
      role: { id: STUDENT_ROLE_ID },
    };

    this.saving.set(true);
    this.form.disable();

    this.studentService
      .create(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dto) => {
          this.snackBar.open(SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
          this.dialogRef.close(dto);
        },
        error: (err: unknown) => {
          console.error('[student-new] failed to create student', err);
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
