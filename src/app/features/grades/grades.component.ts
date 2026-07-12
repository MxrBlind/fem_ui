import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';

import { AuthService } from '@core/services/auth.service';
import { GradeService } from '@core/services/grade.service';
import { GradeDto, GradeRow } from './models/grade.model';

export const LOAD_ERROR_MESSAGE =
  'No se pudieron cargar las calificaciones. Intenta de nuevo más tarde.';
export const DOWNLOAD_ERROR_MESSAGE =
  'No se pudo descargar el certificado. Intenta de nuevo más tarde.';
export const EMPTY_MESSAGE = 'No hay calificaciones registradas.';
export const GRADE_IN_PROGRESS_LABEL = 'En curso';
export const GRADE_FAILED_LABEL = 'No aprobado';
export const PASSING_GRADE = 70;

// Sentinel values used by the sortingDataAccessor so the derived `gradeLabel`
// column can be sorted numerically. "No aprobado" rows sort below "En curso"
// rows, which in turn sort below any numeric grade.
const SORT_SENTINEL_IN_PROGRESS = -1;
const SORT_SENTINEL_FAILED = -2;

export function toGradeLabel(row: Pick<GradeRow, 'active' | 'grade'>): string {
  if (row.active) return GRADE_IN_PROGRESS_LABEL;
  if (row.grade < PASSING_GRADE) return GRADE_FAILED_LABEL;
  return String(row.grade);
}

export function isCertificateEnabled(row: Pick<GradeRow, 'active' | 'grade'>): boolean {
  return !row.active && row.grade >= PASSING_GRADE;
}

@Component({
  selector: 'app-grades',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './grades.component.html',
  styleUrl: './grades.component.scss',
})
export class GradesComponent implements OnInit, AfterViewInit {
  private readonly gradeService = inject(GradeService);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly datePipe = new DatePipe('en-US');

  readonly displayedColumns = [
    'courseName',
    'teacherName',
    'cycleName',
    'startDate',
    'gradeLabel',
    'certificate',
  ];

  readonly rows = signal<GradeRow[]>([]);
  readonly loading = signal(true);
  readonly filterText = signal('');
  readonly downloadingEnrollmentId = signal<number | null>(null);

  readonly studentId = computed<number | null>(() => this.authService.currentUser()?.id ?? null);

  readonly dataSource = new MatTableDataSource<GradeRow>([]);

  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly toGradeLabel = toGradeLabel;
  readonly isCertificateEnabled = isCertificateEnabled;

  constructor() {
    this.dataSource.filterPredicate = (row: GradeRow, filter: string): boolean => {
      if (!filter) return true;
      const haystack = [
        row.courseName,
        row.teacherName,
        row.cycleName,
        this.datePipe.transform(row.startDate, 'dd/MM/yyyy') ?? '',
        toGradeLabel(row),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(filter);
    };

    this.dataSource.sortingDataAccessor = (row: GradeRow, columnId: string): string | number => {
      switch (columnId) {
        case 'startDate':
          return new Date(row.startDate).getTime();
        case 'gradeLabel':
          if (row.active) return SORT_SENTINEL_IN_PROGRESS;
          if (row.grade < PASSING_GRADE) return SORT_SENTINEL_FAILED;
          return row.grade;
        case 'courseName':
          return row.courseName;
        case 'teacherName':
          return row.teacherName;
        case 'cycleName':
          return row.cycleName;
        default:
          return '';
      }
    };

    effect(() => {
      this.dataSource.filter = this.filterText().trim().toLowerCase();
    });
  }

  ngOnInit(): void {
    const id = this.studentId();
    if (id == null) {
      this.loading.set(false);
      return;
    }
    this.gradeService
      .getForStudent(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (grades) => {
          const rows = grades.map((g) => this.toRow(g));
          this.rows.set(rows);
          this.dataSource.data = rows;
        },
        error: (err) => {
          console.error('[grades] failed to load', err);
          this.snackBar.open(LOAD_ERROR_MESSAGE, 'Cerrar', {
            duration: 5000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.sort.active = 'startDate';
      this.sort.direction = 'desc';
      this.dataSource.sort = this.sort;
    }
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
  }

  onFilterInput(value: string): void {
    this.filterText.set(value);
  }

  clearFilter(): void {
    this.filterText.set('');
  }

  onDownloadCertificate(row: GradeRow): void {
    if (!isCertificateEnabled(row)) return;
    if (this.downloadingEnrollmentId() === row.enrollmentId) return;
    const sessionStudentId = this.studentId();
    if (sessionStudentId == null) return;

    this.downloadingEnrollmentId.set(row.enrollmentId);
    this.gradeService
      .downloadCertificate(row.enrollmentId, sessionStudentId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (this.downloadingEnrollmentId() === row.enrollmentId) {
            this.downloadingEnrollmentId.set(null);
          }
        })
      )
      .subscribe({
        next: (blob) => this.saveBlob(blob, `certificate_${row.enrollmentId}.pdf`),
        error: (err) => {
          console.error('[grades] failed to download certificate', err);
          this.snackBar.open(DOWNLOAD_ERROR_MESSAGE, 'Cerrar', {
            duration: 5000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private toRow(dto: GradeDto): GradeRow {
    return {
      enrollmentId: dto.enrollmentId,
      studentId: dto.studentId,
      courseName: dto.courseName,
      teacherName: dto.teacherName,
      cycleName: dto.cycleName,
      startDate: dto.startDate,
      grade: dto.grade,
      active: dto.active,
      raw: dto,
    };
  }
}
