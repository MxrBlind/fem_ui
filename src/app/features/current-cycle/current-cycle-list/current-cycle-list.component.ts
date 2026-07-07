import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { HasRoleDirective } from '@core/auth/has-role.directive';
import { CourseService } from '@core/services/course.service';
import { CycleService } from '@core/services/cycle.service';
import { CycleDto } from '@features/enrollments/models/cycle.model';
import { CourseRow } from '@features/enrollments/models/enrollment.model';

const LOAD_ERROR_MESSAGE =
  'No se pudieron cargar los cursos del ciclo actual. Intenta de nuevo más tarde.';

@Component({
  selector: 'app-current-cycle-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    HasRoleDirective,
  ],
  templateUrl: './current-cycle-list.component.html',
  styleUrl: './current-cycle-list.component.scss',
})
export class CurrentCycleListComponent implements OnInit, AfterViewInit {
  private readonly cycleService = inject(CycleService);
  private readonly courseService = inject(CourseService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly displayedColumns = [
    'id',
    'subjectDescription',
    'credits',
    'teacherFullName',
    'categoryTitle',
    'levelTitle',
    'actions',
  ];

  readonly rows = signal<CourseRow[]>([]);
  readonly currentCycle = signal<CycleDto | null>(null);
  readonly loading = signal(true);
  readonly filterText = signal('');

  readonly title = computed(() => {
    const cycle = this.currentCycle();
    return `Materias del ciclo actual: ${cycle?.description ?? '…'}`;
  });

  readonly dataSource = new MatTableDataSource<CourseRow>([]);

  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  constructor() {
    this.dataSource.filterPredicate = (row: CourseRow, filter: string): boolean => {
      if (!filter) return true;
      const haystack = [
        String(row.id),
        row.subjectDescription,
        String(row.credits),
        row.teacherFullName,
        row.categoryTitle,
        row.levelTitle,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(filter);
    };

    effect(() => {
      this.dataSource.filter = this.filterText().trim().toLowerCase();
    });
  }

  ngOnInit(): void {
    this.cycleService
      .getCurrent()
      .pipe(
        switchMap((cycle) => {
          this.currentCycle.set(cycle);
          return this.courseService.listByCycleAsRows(cycle.id ?? 0);
        }),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.dataSource.data = rows;
        },
        error: (err) => {
          console.error('[current-cycle-list] failed to load', err);
          this.snackBar.open(LOAD_ERROR_MESSAGE, 'Cerrar', {
            duration: 5000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.sort.active = 'subjectDescription';
      this.sort.direction = 'asc';
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

  onCreate(): void {
    console.debug('[current-cycle-list] onCreate placeholder');
  }

  onEdit(row: CourseRow): void {
    console.debug('[current-cycle-list] onEdit placeholder', row?.id);
  }

  onDelete(row: CourseRow): void {
    console.debug('[current-cycle-list] onDelete placeholder', row?.id);
  }
}
