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
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ProfileDto, UserDto } from '@core/models/auth.model';
import { AuthService } from '@core/services/auth.service';
import { ProfileService } from '@core/services/profile.service';
import { ChangePasswordComponent } from '@features/profile/change-password/change-password.component';
import {
  nonBlankValidator,
  parseIsoDate,
} from '@features/cycles/shared/cycle-form.utils';
import { toBirthDateIso } from '@features/teachers/shared/teacher-form.utils';

export const LOAD_ERROR_MESSAGE = 'Error al cargar el perfil';
export const SUCCESS_MESSAGE = 'Perfil actualizado exitosamente';
export const ERROR_MESSAGE = 'Error al actualizar el perfil';

@Component({
  selector: 'app-profile-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './profile-edit.component.html',
  styleUrl: './profile-edit.component.scss',
})
export class ProfileEditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = signal<UserDto | null>(null);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);

  readonly username = computed(() => this.auth.currentUser()?.username ?? '');

  readonly form = this.fb.nonNullable.group({
    name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator, Validators.maxLength(100)],
    }),
    parentLastName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator, Validators.maxLength(100)],
    }),
    motherLastName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator, Validators.maxLength(100)],
    }),
    birthDate: new FormControl<Date | null>(null, {
      validators: [Validators.required],
    }),
    email: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(50)],
    }),
    phone: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator, Validators.maxLength(50)],
    }),
    address: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator, Validators.maxLength(200)],
    }),
    church: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, nonBlankValidator, Validators.maxLength(200)],
    }),
  });

  ngOnInit(): void {
    this.form.disable();
    this.profileService
      .getMe()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dto) => {
          this.user.set(dto);
          this.prefillForm(dto.profile);
          this.loading.set(false);
          this.form.enable();
        },
        error: (err: unknown) => {
          console.error('[profile-edit] failed to load profile', err);
          this.loadFailed.set(true);
          this.loading.set(false);
          this.snackBar.open(LOAD_ERROR_MESSAGE, 'Cerrar', {
            duration: 3000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving() || this.loadFailed()) return;

    const id = this.user()?.id;
    if (id == null) {
      this.snackBar.open(ERROR_MESSAGE, 'Cerrar', {
        duration: 3000,
        panelClass: 'snackbar-error',
      });
      return;
    }

    const value = this.form.getRawValue();
    if (!value.birthDate) return;

    const payload: ProfileDto = {
      name: value.name.trim(),
      parentLastName: value.parentLastName.trim(),
      motherLastName: value.motherLastName.trim(),
      birthDate: toBirthDateIso(value.birthDate),
      email: value.email.trim(),
      phone: value.phone.trim(),
      address: value.address.trim(),
      church: value.church.trim(),
    };

    this.saving.set(true);
    this.form.disable();

    this.profileService
      .update(id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dto) => {
          this.user.set(dto);
          this.prefillForm(dto.profile);
          this.saving.set(false);
          this.form.enable();
          this.snackBar.open(SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
        },
        error: (err: unknown) => {
          console.error('[profile-edit] failed to update profile', err);
          this.saving.set(false);
          this.form.enable();
          this.snackBar.open(ERROR_MESSAGE, 'Cerrar', {
            duration: 3000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  onChangePassword(): void {
    this.dialog.open(ChangePasswordComponent, {
      width: '480px',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
  }

  private prefillForm(profile: ProfileDto | undefined): void {
    this.form.patchValue({
      name: profile?.name ?? '',
      parentLastName: profile?.parentLastName ?? '',
      motherLastName: profile?.motherLastName ?? '',
      birthDate: parseIsoDate(profile?.birthDate),
      email: profile?.email ?? '',
      phone: profile?.phone ?? '',
      address: profile?.address ?? '',
      church: profile?.church ?? '',
    });
  }
}
