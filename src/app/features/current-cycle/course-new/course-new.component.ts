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
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { UserDto } from '@core/models/auth.model';
import { CourseService } from '@core/services/course.service';
import { CycleService } from '@core/services/cycle.service';
import { SubjectService } from '@core/services/subject.service';
import { UserService } from '@core/services/user.service';
import { CycleDto } from '@features/enrollments/models/cycle.model';
import {
  CourseDto,
  CreateCourseRequest,
  SubjectDto,
} from '@features/enrollments/models/enrollment.model';

export const SUCCESS_MESSAGE = 'Curso creado exitosamente';
export const ERROR_MESSAGE = 'Error al crear este registro';
export const LOAD_ERROR_MESSAGE = 'No se pudieron cargar los datos del formulario';

interface LoadResult {
  subjects: SubjectDto[];
  teachers: UserDto[];
  cycle: CycleDto;
}

@Component({
  selector: 'app-course-new',
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
  templateUrl: './course-new.component.html',
  styleUrl: './course-new.component.scss',
})
export class CourseNewComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly subjectService = inject(SubjectService);
  private readonly userService = inject(UserService);
  private readonly cycleService = inject(CycleService);
  private readonly courseService = inject(CourseService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(MatDialogRef<CourseNewComponent, CourseDto>);

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);

  readonly subjects = signal<SubjectDto[]>([]);
  readonly teachers = signal<UserDto[]>([]);
  readonly currentCycle = signal<CycleDto | null>(null);

  readonly subjectSearch = signal('');
  readonly teacherSearch = signal('');

  readonly filteredSubjects = computed(() => {
    const q = this.subjectSearch().trim().toLowerCase();
    const list = this.subjects();
    if (!q) return list;
    return list.filter((s) => this.displaySubject(s).toLowerCase().includes(q));
  });

  readonly filteredTeachers = computed(() => {
    const q = this.teacherSearch().trim().toLowerCase();
    const list = this.teachers();
    if (!q) return list;
    return list.filter((u) => this.displayTeacher(u).toLowerCase().includes(q));
  });

  readonly form = this.fb.nonNullable.group({
    subjectId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    teacherId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    credits: new FormControl<number>(0, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(1),
        Validators.max(100),
        Validators.pattern(/^\d+$/),
      ],
    }),
  });

  ngOnInit(): void {
    this.form.disable();
    forkJoin({
      subjects: this.subjectService.list(),
      teachers: this.userService.listByRole('ROLE_TEACHER'),
      cycle: this.cycleService.getCurrent(),
    })
      .pipe(
        catchError((err: unknown) => {
          console.error('[course-new] failed to load form data', err);
          this.loadFailed.set(true);
          this.snackBar.open(LOAD_ERROR_MESSAGE, 'Cerrar', {
            duration: 3000,
            panelClass: 'snackbar-error',
          });
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((result: LoadResult | null) => {
        this.loading.set(false);
        if (!result) return;
        this.subjects.set(result.subjects);
        this.teachers.set(result.teachers);
        this.currentCycle.set(result.cycle);
        this.form.enable();
      });
  }

  displaySubject(subject: SubjectDto | null | undefined): string {
    if (!subject) return '';
    const desc = subject.description ?? '';
    const code = subject.code ?? '';
    return code ? `${desc} — ${code}` : desc;
  }

  displayTeacher(user: UserDto | null | undefined): string {
    if (!user) return '';
    const profile = user.profile;
    const first = (profile?.name ?? '').trim();
    const last = (profile?.parentLastName ?? '').trim();
    const label = [first, last].filter((p) => p.length > 0).join(' ');
    return label.length > 0 ? label : user.username;
  }

  displaySubjectById = (id: number | null): string => {
    if (id == null) return '';
    const s = this.subjects().find((x) => x.id === id);
    return s ? this.displaySubject(s) : '';
  };

  displayTeacherById = (id: number | null): string => {
    if (id == null) return '';
    const u = this.teachers().find((x) => x.id === id);
    return u ? this.displayTeacher(u) : '';
  };

  onSubjectInput(value: string): void {
    this.subjectSearch.set(value);
    if (this.form.controls.subjectId.value != null) {
      const selected = this.subjects().find(
        (s) => s.id === this.form.controls.subjectId.value
      );
      if (!selected || this.displaySubject(selected) !== value) {
        this.form.controls.subjectId.setValue(null);
      }
    }
  }

  onTeacherInput(value: string): void {
    this.teacherSearch.set(value);
    if (this.form.controls.teacherId.value != null) {
      const selected = this.teachers().find(
        (u) => u.id === this.form.controls.teacherId.value
      );
      if (!selected || this.displayTeacher(selected) !== value) {
        this.form.controls.teacherId.setValue(null);
      }
    }
  }

  onSubjectSelected(subject: SubjectDto): void {
    if (subject.id == null) return;
    this.form.controls.subjectId.setValue(subject.id);
    this.subjectSearch.set(this.displaySubject(subject));
  }

  onTeacherSelected(user: UserDto): void {
    if (user.id == null) return;
    this.form.controls.teacherId.setValue(user.id);
    this.teacherSearch.set(this.displayTeacher(user));
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving() || this.loadFailed()) return;

    const { subjectId, teacherId, credits } = this.form.getRawValue();
    const cycleId = this.currentCycle()?.id;
    if (subjectId == null || teacherId == null || cycleId == null) return;

    const payload: CreateCourseRequest = {
      subject: { id: subjectId },
      teacher: { id: teacherId },
      cycle: { id: cycleId },
      credits,
    };

    this.saving.set(true);
    this.form.disable();

    this.courseService
      .create(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dto) => {
          this.snackBar.open(SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
          this.dialogRef.close(dto);
        },
        error: (err: unknown) => {
          console.error('[course-new] failed to create course', err);
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
