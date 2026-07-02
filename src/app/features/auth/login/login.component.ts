import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs/operators';

import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly submitting = signal(false);
  protected readonly passwordVisible = signal(false);

  protected readonly usernameInput = viewChild<ElementRef<HTMLInputElement>>('usernameInput');
  protected readonly passwordInput = viewChild<ElementRef<HTMLInputElement>>('passwordInput');

  protected readonly loginForm = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(4)]]
  });

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((v) => !v);
  }

  protected onSubmit(): void {
    if (this.submitting()) return;
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }

    this.submitting.set(true);
    const credentials = this.loginForm.getRawValue();

    this.auth
      .login(credentials)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.snackBar.open('Sesión iniciada', undefined, { duration: 2000 });
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 401 || err.status === 403) {
            this.snackBar.open('Usuario o contraseña incorrectos.', undefined, {
              duration: 5000,
              panelClass: 'snackbar-error'
            });
            this.loginForm.controls.password.reset('');
            queueMicrotask(() => this.passwordInput()?.nativeElement.focus());
          } else {
            this.snackBar.open('No fue posible iniciar sesión. Inténtalo de nuevo.', undefined, {
              duration: 5000,
              panelClass: 'snackbar-error'
            });
          }
        }
      });
  }

  protected onRegister(): void {
    this.snackBar.open('Pronto…', undefined, { duration: 3000 });
  }

  private focusFirstInvalid(): void {
    if (this.loginForm.controls.username.invalid) {
      this.usernameInput()?.nativeElement.focus();
    } else if (this.loginForm.controls.password.invalid) {
      this.passwordInput()?.nativeElement.focus();
    }
  }
}
