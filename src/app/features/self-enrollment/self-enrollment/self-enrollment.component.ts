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
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { finalize, forkJoin, of, switchMap } from 'rxjs';

import { ROLE_HOME_ROUTES } from '@core/auth/rbac';
import { AuthService } from '@core/services/auth.service';
import { CourseService } from '@core/services/course.service';
import { CycleService } from '@core/services/cycle.service';
import { EnrollmentService } from '@core/services/enrollment.service';
import { CycleDto } from '@features/enrollments/models/cycle.model';
import {
  CourseDto,
  PaymentMode,
  SelfEnrollmentRequest,
} from '@features/enrollments/models/enrollment.model';
import { parseApiError } from '@core/errors/api-error';
import { NOT_ALLOWED_MESSAGE } from '@core/errors/error-messages';

export const LOAD_ERROR_MESSAGE = 'Error al cargar las materias';
export const SUCCESS_MESSAGE = 'Preinscripción registrada con éxito';
export const ERROR_MESSAGE = 'Un error ha ocurrido al preinscribirse. Inténtelo más tarde';
export const NO_OPEN_CYCLE_MESSAGE = 'No hay un ciclo abierto para preinscripción.';
export const NO_COURSES_MESSAGE = 'No hay materias disponibles para este ciclo.';

export const PAYMENT_MODE_OPTIONS: ReadonlyArray<{ label: string; value: PaymentMode }> = [
  { label: 'Un pago', value: 'SINGLE' },
  { label: 'Varios pagos', value: 'MULTIPLE' },
];

interface CourseRowView {
  id: number;
  label: string;
  enrolled: boolean;
  checked: boolean;
}

export function buildSelfEnrollmentRequest(
  cycleId: number,
  studentId: number,
  courseIds: number[],
  paymentMode: PaymentMode
): SelfEnrollmentRequest {
  return { cycleId, studentId, courseIds, paymentMode };
}

@Component({
  selector: 'app-self-enrollment',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  templateUrl: './self-enrollment.component.html',
  styleUrl: './self-enrollment.component.scss',
})
export class SelfEnrollmentComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly cycleService = inject(CycleService);
  private readonly courseService = inject(CourseService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly paymentModeOptions = PAYMENT_MODE_OPTIONS;
  readonly noOpenCycleMessage = NO_OPEN_CYCLE_MESSAGE;
  readonly noCoursesMessage = NO_COURSES_MESSAGE;
  readonly coursesLabelId = 'self-enrollment-courses-label';

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);
  readonly cycle = signal<CycleDto | null>(null);
  readonly courses = signal<CourseDto[]>([]);
  readonly enrolledCourseIds = signal<ReadonlySet<number>>(new Set());
  readonly selectedCourseIds = signal<ReadonlySet<number>>(new Set());

  readonly form = this.fb.nonNullable.group({
    paymentMode: this.fb.nonNullable.control<PaymentMode>('SINGLE'),
  });

  readonly courseRows = computed<CourseRowView[]>(() => {
    const enrolled = this.enrolledCourseIds();
    const selected = this.selectedCourseIds();
    return this.courses()
      .filter((course): course is CourseDto & { id: number } => course.id != null)
      .map((course) => ({
        id: course.id,
        label: course.subject.description,
        enrolled: enrolled.has(course.id),
        checked: enrolled.has(course.id) || selected.has(course.id),
      }));
  });

  readonly canSubmit = computed(
    () => !this.loading() && !this.saving() && this.selectedCourseIds().size > 0
  );

  ngOnInit(): void {
    this.cycleService
      .getOpenForEnrollment()
      .pipe(
        switchMap((cycle) =>
          cycle?.id == null
            ? of(null)
            : forkJoin({
                cycle: of(cycle),
                courses: this.courseService.listByCycle(cycle.id),
                enrollments: this.enrollmentService.listMyByCycle(cycle.id),
              })
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (data) => {
          if (data) {
            this.cycle.set(data.cycle);
            this.courses.set(data.courses);
            this.enrolledCourseIds.set(
              new Set(
                data.enrollments
                  .map((enrollment) => enrollment.course?.id)
                  .filter((id): id is number => id != null)
              )
            );
          }
          this.loading.set(false);
        },
        error: (err: unknown) => {
          console.error('[self-enrollment] failed to load data', err);
          this.loadFailed.set(true);
          this.loading.set(false);
          this.snackBar.open(LOAD_ERROR_MESSAGE, 'Cerrar', {
            duration: 3000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  toggleCourse(courseId: number, checked: boolean): void {
    this.selectedCourseIds.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(courseId);
      } else {
        next.delete(courseId);
      }
      return next;
    });
  }

  onSubmit(): void {
    if (!this.canSubmit()) return;

    const cycleId = this.cycle()?.id;
    const studentId = this.auth.currentUser()?.id;
    if (cycleId == null || studentId == null) {
      this.showError(ERROR_MESSAGE);
      return;
    }

    const request = buildSelfEnrollmentRequest(
      cycleId,
      studentId,
      [...this.selectedCourseIds()],
      this.form.getRawValue().paymentMode
    );

    this.saving.set(true);
    this.enrollmentService
      .selfEnroll(request)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.snackBar.open(SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
          void this.router.navigate([ROLE_HOME_ROUTES.student]);
        },
        error: (err: unknown) => {
          console.error('[self-enrollment] failed to submit', err);
          this.showError(parseApiError(err).status === 403 ? NOT_ALLOWED_MESSAGE : ERROR_MESSAGE);
          void this.router.navigate([ROLE_HOME_ROUTES.student]);
        },
      });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000,
      panelClass: 'snackbar-error',
    });
  }
}
