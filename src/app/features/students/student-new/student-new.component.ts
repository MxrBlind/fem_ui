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
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { catchError, of } from 'rxjs';

import { UserDto } from '@core/models/auth.model';
import { LevelService } from '@core/services/level.service';
import { StudentService } from '@core/services/student.service';
import { LevelDto } from '@features/enrollments/models/enrollment.model';
import { CreateStudentRequest } from '@features/students/models/create-student.request';
import {
  nonBlankValidator,
  toBirthDateIso,
} from '@features/students/shared/student-form.utils';
import { STUDENT_ROLE_ID } from '@features/students/students.constants';

export { toBirthDateIso };

export const SUCCESS_MESSAGE = 'Registro creado exitosamente';
export const ERROR_MESSAGE = 'Error al crear este registro';
export const LOAD_ERROR_MESSAGE = 'No se pudieron cargar los datos del formulario';

@Component({
  selector: 'app-student-new',
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
  templateUrl: './student-new.component.html',
  styleUrl: './student-new.component.scss',
})
export class StudentNewComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly studentService = inject(StudentService);
  private readonly levelService = inject(LevelService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(
    MatDialogRef<StudentNewComponent, UserDto>
  );

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
    levelId: new FormControl<number | null>(null, {
      validators: [Validators.required],
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

  // Visible text of the level autocomplete. It lives outside the form group so the group keeps
  // exactly the payload controls, but it gives mat-form-field a control to derive its error state from.
  readonly levelText = new FormControl<string | LevelDto>('', {
    nonNullable: true,
    validators: [() => (this.form.controls.levelId.value == null ? { required: true } : null)],
  });

  ngOnInit(): void {
    this.setFormEnabled(false);
    this.levelService
      .list()
      .pipe(
        catchError((err: unknown) => {
          console.error('[student-new] failed to load form data', err);
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
    if (this.form.controls.levelId.value != null) {
      const selected = this.levels().find(
        (l) => l.id === this.form.controls.levelId.value
      );
      if (!selected || this.displayLevel(selected) !== value) {
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

    const value = this.form.getRawValue();
    if (!value.birthDate || value.levelId == null) return;

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
      level: { id: value.levelId },
    };

    this.saving.set(true);
    this.setFormEnabled(false);

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
          this.setFormEnabled(true);
        },
      });
  }

  private setFormEnabled(enabled: boolean): void {
    if (enabled) {
      this.form.enable();
      this.levelText.enable();
    } else {
      this.form.disable();
      this.levelText.disable();
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
