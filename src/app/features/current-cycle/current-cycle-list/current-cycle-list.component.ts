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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize, of } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs/operators';

import { HasRoleDirective } from '@core/auth/has-role.directive';
import { CourseService } from '@core/services/course.service';
import { CycleService } from '@core/services/cycle.service';
import { CycleDto } from '@features/enrollments/models/cycle.model';
import { CourseDto, CourseRow } from '@features/enrollments/models/enrollment.model';
import {
  ExcelExportColumn,
  ExcelExportConfig,
  ExportToExcelButtonComponent,
} from '@shared/table-export';
import { CourseDeleteConfirmComponent } from '../course-delete-confirm/course-delete-confirm.component';
import { CourseEditComponent } from '../course-edit/course-edit.component';
import { CourseNewComponent } from '../course-new/course-new.component';

const LOAD_ERROR_MESSAGE =
  'No se pudieron cargar los cursos del ciclo actual. Intenta de nuevo más tarde.';
export const DELETE_SUCCESS_MESSAGE = 'Registro eliminado';
export const DELETE_ERROR_MESSAGE = 'Hubo un error con el registro';

@Component({
  selector: 'app-current-cycle-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
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
    ExportToExcelButtonComponent,
  ],
  templateUrl: './current-cycle-list.component.html',
  styleUrl: './current-cycle-list.component.scss',
})
export class CurrentCycleListComponent implements OnInit, AfterViewInit {
  private readonly cycleService = inject(CycleService);
  private readonly courseService = inject(CourseService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
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
  readonly deletingId = signal<number | null>(null);

  readonly title = computed(() => {
    const cycle = this.currentCycle();
    return `Materias del ciclo actual: ${cycle?.description ?? '…'}`;
  });

  readonly dataSource = new MatTableDataSource<CourseRow>([]);

  readonly excelColumns: ExcelExportColumn<CourseRow>[] = [
    { header: 'ID', key: 'id', value: (r) => r.id, width: 8 },
    { header: 'Nombre del curso', key: 'subjectDescription', value: (r) => r.subjectDescription },
    { header: 'Créditos', key: 'credits', value: (r) => r.credits },
    { header: 'Profesor', key: 'teacherFullName', value: (r) => r.teacherFullName },
    { header: 'Categoría', key: 'categoryTitle', value: (r) => r.categoryTitle },
    { header: 'Nivel', key: 'levelTitle', value: (r) => r.levelTitle },
  ];

  readonly excelConfig = (): ExcelExportConfig<CourseRow> => ({
    rows: this.dataSource.filteredData,
    columns: this.excelColumns,
    entitySlug: 'current-cycle',
    sheetName: 'Ciclo actual',
    filteredBy: this.filterText(),
  });

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
    const ref = this.dialog.open<CourseNewComponent, unknown, CourseDto>(
      CourseNewComponent,
      { width: '480px', autoFocus: 'first-tabbable' }
    );
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((created) => {
        if (!created) return;
        this.refreshRows('create');
      });
  }

  onEdit(row: CourseRow): void {
    const ref = this.dialog.open<CourseEditComponent, CourseDto, CourseDto>(
      CourseEditComponent,
      { width: '480px', autoFocus: 'first-tabbable', data: row.raw }
    );
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updated) => {
        if (!updated) return;
        this.refreshRows('edit');
      });
  }

  private refreshRows(source: 'create' | 'edit' | 'delete'): void {
    const cycleId = this.currentCycle()?.id;
    if (cycleId == null) return;
    this.courseService
      .listByCycleAsRows(cycleId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.dataSource.data = rows;
        },
        error: (err) => {
          console.error(`[current-cycle-list] failed to refresh after ${source}`, err);
        },
      });
  }

  onDelete(row: CourseRow): void {
    const ref = this.dialog.open<
      CourseDeleteConfirmComponent,
      { row: CourseRow },
      boolean
    >(CourseDeleteConfirmComponent, {
      width: '420px',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      data: { row },
    });

    ref
      .afterClosed()
      .pipe(
        filter((confirmed): confirmed is true => confirmed === true),
        switchMap(() => {
          this.deletingId.set(row.id);
          return this.courseService.delete(row.id).pipe(
            switchMap(() => {
              const cycleId = this.currentCycle()?.id ?? 0;
              return this.courseService.listByCycleAsRows(cycleId);
            }),
            catchError((err) => {
              console.error('[current-cycle-list] failed to delete', err);
              this.snackBar.open(DELETE_ERROR_MESSAGE, 'Cerrar', {
                duration: 5000,
                panelClass: 'snackbar-error',
              });
              return of(null);
            }),
            finalize(() => this.deletingId.set(null))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((rows) => {
        if (rows === null) return;
        this.rows.set(rows);
        this.dataSource.data = rows;
        this.snackBar.open(DELETE_SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
      });
  }
}
