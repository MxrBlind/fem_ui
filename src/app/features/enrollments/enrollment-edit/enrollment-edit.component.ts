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
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';

import { UserDto } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
import { CourseService } from '../../../core/services/course.service';
import { CycleService } from '../../../core/services/cycle.service';
import { EnrollmentService } from '../../../core/services/enrollment.service';
import { UserService } from '../../../core/services/user.service';
import { CycleDto } from '../models/cycle.model';
import { CourseDto, EnrollmentDto } from '../models/enrollment.model';

export const SUCCESS_MESSAGE = 'Registro creado exitosamente';
export const ERROR_MESSAGE = 'Error al crear este registro';
export const LOAD_ERROR_MESSAGE = 'No se pudieron cargar los datos del formulario';

interface LoadResult {
  students: UserDto[];
  cycle: CycleDto;
  courses: CourseDto[];
}

@Component({
  selector: 'app-enrollment-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './enrollment-edit.component.html',
  styleUrl: './enrollment-edit.component.scss',
})
export class EnrollmentEditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly courseService = inject(CourseService);
  private readonly cycleService = inject(CycleService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  readonly dialogRef = inject(MatDialogRef<EnrollmentEditComponent, EnrollmentDto>);
  readonly data = inject<{ enrollment: EnrollmentDto }>(MAT_DIALOG_DATA);

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);

  readonly students = signal<UserDto[]>([]);
  readonly courses = signal<CourseDto[]>([]);
  readonly currentCycle = signal<CycleDto | null>(null);

  readonly studentSearch = signal('');
  readonly courseSearch = signal('');

  readonly filteredStudents = computed(() => {
    const q = this.studentSearch().trim().toLowerCase();
    const list = this.students();
    if (!q) return list;
    return list.filter((u) => this.displayStudent(u).toLowerCase().includes(q));
  });

  readonly filteredCourses = computed(() => {
    const q = this.courseSearch().trim().toLowerCase();
    const list = this.courses();
    if (!q) return list;
    return list.filter((c) => this.displayCourse(c).toLowerCase().includes(q));
  });

  readonly form = this.fb.nonNullable.group({
    studentId: new FormControl<number | null>(
      this.data.enrollment.student?.id ?? null,
      { validators: [Validators.required] }
    ),
    courseId: new FormControl<number | null>(
      this.data.enrollment.course?.id ?? null,
      { validators: [Validators.required] }
    ),
    scholarshipPercent: new FormControl<number>(
      this.data.enrollment.scholarshipPercent ?? 0,
      {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.min(0),
          Validators.max(100),
          Validators.pattern(/^\d+$/),
        ],
      }
    ),
  });

  ngOnInit(): void {
    this.form.disable();

    forkJoin({
      students: this.userService.listByRole('ROLE_STUDENT'),
      cycle: this.cycleService.getCurrent(),
    })
      .pipe(
        switchMap(({ students, cycle }) => {
          if (cycle.id == null) {
            return of({ students, cycle, courses: [] as CourseDto[] } satisfies LoadResult);
          }
          return this.courseService
            .listByCycle(cycle.id)
            .pipe(
              switchMap((courses) => of({ students, cycle, courses } satisfies LoadResult))
            );
        }),
        catchError((err: unknown) => {
          console.error('[enrollment-edit]', err);
          this.loadFailed.set(true);
          this.snackBar.open(LOAD_ERROR_MESSAGE, 'Cerrar', {
            duration: 3000,
            panelClass: 'snackbar-error',
          });
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((result) => {
        if (!result) return;
        this.students.set(result.students);
        this.currentCycle.set(result.cycle);
        this.courses.set(result.courses);

        const isTeacherOnly =
          this.authService.hasRole('teacher') && !this.authService.hasRole('admin');

        if (isTeacherOnly) {
          this.form.controls.studentId.disable({ emitEvent: false });
          this.form.controls.courseId.disable({ emitEvent: false });
          this.form.controls.scholarshipPercent.enable({ emitEvent: false });
        } else {
          this.form.enable({ emitEvent: false });
        }
      });
  }

  get isTeacherOnly(): boolean {
    return this.authService.hasRole('teacher') && !this.authService.hasRole('admin');
  }

  displayStudent = (user: UserDto | null | undefined): string => {
    if (!user) return '';
    if (typeof user === 'object' && !('username' in user)) return '';
    const profile = user.profile;
    const first = (profile?.name ?? '').trim();
    const last = (profile?.parentLastName ?? '').trim();
    const label = [first, last].filter((p) => p.length > 0).join(' ');
    return label.length > 0 ? label : user.username;
  };

  displayStudentById = (id: number | null): string => {
    if (id == null) return '';
    const user = this.students().find((u) => u.id === id);
    return user ? this.displayStudent(user) : '';
  };

  displayCourse = (course: CourseDto | null | undefined): string => {
    if (!course) return '';
    const desc = course.subject?.description ?? '';
    const code = course.subject?.code ?? '';
    return code ? `${desc} — ${code}` : desc;
  };

  displayCourseById = (id: number | null): string => {
    if (id == null) return '';
    const course = this.courses().find((c) => c.id === id);
    return course ? this.displayCourse(course) : '';
  };

  onStudentInput(value: string): void {
    this.studentSearch.set(value);
    if (this.form.controls.studentId.value != null) {
      const selected = this.students().find(
        (u) => u.id === this.form.controls.studentId.value
      );
      if (!selected || this.displayStudent(selected) !== value) {
        this.form.controls.studentId.setValue(null);
      }
    }
  }

  onCourseInput(value: string): void {
    this.courseSearch.set(value);
    if (this.form.controls.courseId.value != null) {
      const selected = this.courses().find(
        (c) => c.id === this.form.controls.courseId.value
      );
      if (!selected || this.displayCourse(selected) !== value) {
        this.form.controls.courseId.setValue(null);
      }
    }
  }

  onStudentSelected(user: UserDto): void {
    if (user.id == null) return;
    this.form.controls.studentId.setValue(user.id);
    this.studentSearch.set(this.displayStudent(user));
  }

  onCourseSelected(course: CourseDto): void {
    if (course.id == null) return;
    this.form.controls.courseId.setValue(course.id);
    this.courseSearch.set(this.displayCourse(course));
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving() || this.loadFailed()) return;

    const raw = this.form.getRawValue();
    const payload: EnrollmentDto = {
      ...this.data.enrollment,
      student: { id: raw.studentId!, username: '' },
      course: {
        ...(this.data.enrollment.course ?? {}),
        id: raw.courseId!,
      } as CourseDto,
      scholarshipPercent: raw.scholarshipPercent,
    };

    this.saving.set(true);

    this.enrollmentService
      .update(this.data.enrollment.id!, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dto) => {
          this.snackBar.open(SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
          this.dialogRef.close(dto);
        },
        error: (err: unknown) => {
          console.error('[enrollment-edit]', err);
          this.snackBar.open(ERROR_MESSAGE, 'Cerrar', {
            duration: 3000,
            panelClass: 'snackbar-error',
          });
          this.saving.set(false);
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
