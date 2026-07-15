import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '@core/services/auth.service';
import { ProfileService } from '@core/services/profile.service';
import { nonBlankValidator } from '@features/cycles/shared/cycle-form.utils';

export const SUCCESS_MESSAGE = 'Password actualizado exitosamente';
export const ERROR_MESSAGE =
  'Error al actualizar el password. Verifica la información.';
export const PASSWORDS_MISMATCH_MESSAGE = 'Las contraseñas no coinciden';

export function passwordsMatchValidator(
  group: AbstractControl
): ValidationErrors | null {
  const next = group.get('newPassword')?.value as string | null;
  const confirm = group.get('confirmPassword')?.value as string | null;
  if (!next || !confirm) return null;
  return next === confirm ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-change-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss',
})
export class ChangePasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(
    MatDialogRef<ChangePasswordComponent, boolean>
  );

  readonly saving = signal(false);

  readonly passwordsMismatchMessage = PASSWORDS_MISMATCH_MESSAGE;

  readonly form = this.fb.nonNullable.group(
    {
      currentPassword: new FormControl<string>('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.maxLength(20),
          nonBlankValidator,
        ],
      }),
      newPassword: new FormControl<string>('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(20),
          nonBlankValidator,
        ],
      }),
      confirmPassword: new FormControl<string>('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(20),
          nonBlankValidator,
        ],
      }),
    },
    { validators: [passwordsMatchValidator] }
  );

  onSubmit(): void {
    if (this.form.invalid || this.saving()) return;

    const userId = this.auth.currentUser()?.id;
    if (userId == null) {
      this.snackBar.open(ERROR_MESSAGE, 'Cerrar', {
        duration: 3000,
        panelClass: 'snackbar-error',
      });
      return;
    }

    const { currentPassword, newPassword } = this.form.getRawValue();

    this.saving.set(true);
    this.form.disable();

    this.profileService
      .changePassword(userId, { oldPassword: currentPassword, newPassword })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open(SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: (err: unknown) => {
          console.error('[change-password] failed to update password', err);
          this.saving.set(false);
          this.form.enable();
          this.snackBar.open(ERROR_MESSAGE, 'Cerrar', {
            duration: 3000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
