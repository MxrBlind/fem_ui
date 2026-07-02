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
import { forkJoin, finalize } from 'rxjs';
import { switchMap, filter } from 'rxjs/operators';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { HasRoleDirective } from '@core/auth/has-role.directive';
import { CycleService } from '@core/services/cycle.service';
import { EnrollmentService } from '@core/services/enrollment.service';
import { EnrollmentEditComponent, SUCCESS_MESSAGE } from '../enrollment-edit/enrollment-edit.component';
import { CycleDto } from '../models/cycle.model';
import { EnrollmentDto, EnrollmentRow } from '../models/enrollment.model';
import {EnrollmentNewComponent} from '@features/enrollments/enrollment-new/enrollment-new.component';

const LOAD_ERROR_MESSAGE = 'No se pudieron cargar las inscripciones. Intenta de nuevo más tarde.';

@Component({
  selector: 'app-enrollment-list',
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
    MatDialogModule,
    HasRoleDirective,
  ],
  templateUrl: './enrollment-list.component.html',
  styleUrl: './enrollment-list.component.scss',
})
export class EnrollmentListComponent implements OnInit, AfterViewInit {
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly cycleService = inject(CycleService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);

  readonly displayedColumns = ['id', 'fullName', 'church', 'subject', 'category', 'grade', 'actions'];

  readonly rows = signal<EnrollmentRow[]>([]);
  readonly currentCycle = signal<CycleDto | null>(null);
  readonly loading = signal(true);
  readonly filterText = signal('');

  readonly title = computed(() => {
    const cycle = this.currentCycle();
    return `Materias del ciclo actual: ${cycle?.description ?? '…'}`;
  });

  readonly dataSource = new MatTableDataSource<EnrollmentRow>([]);

  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  constructor() {
    this.dataSource.filterPredicate = (row: EnrollmentRow, filter: string): boolean => {
      if (!filter) return true;
      const haystack = [
        String(row.id),
        row.fullName,
        row.church,
        row.subject,
        row.category,
        String(row.grade),
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
    forkJoin({
      cycle: this.cycleService.getCurrent(),
      enrollments: this.enrollmentService.listAllAsRows(),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: ({ cycle, enrollments }) => {
          this.currentCycle.set(cycle);
          this.rows.set(enrollments);
          this.dataSource.data = enrollments;
        },
        error: (err) => {
          console.error('[enrollment-list] failed to load', err);
          this.snackBar.open(LOAD_ERROR_MESSAGE, 'Cerrar', {
            duration: 5000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.sort.active = 'fullName';
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
    const ref = this.dialog.open<EnrollmentNewComponent, void, EnrollmentDto>(
      EnrollmentNewComponent,
      {
        width: '480px',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      }
    );
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((dto) => {
        if (!dto) return;
        this.refreshRows();
      });
  }

  private refreshRows(): void {
    this.enrollmentService
      .listAllAsRows()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.dataSource.data = rows;
        },
        error: (err) => {
          console.error('[enrollment-list] failed to refresh', err);
        },
      });
  }

  onEdit(row: EnrollmentRow): void {
    const ref = this.dialog.open(EnrollmentEditComponent, {
      width: '480px',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      data: { enrollment: row.raw },
    });

    ref
      .afterClosed()
      .pipe(
        filter((dto): dto is EnrollmentDto => !!dto),
        switchMap(() => this.enrollmentService.listAllAsRows()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((rows) => {
        this.dataSource.data = rows;
        this.rows.set(rows);
        this.snackBar.open(SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
      });
  }

  onDelete(row: EnrollmentRow): void {
    console.debug('[enrollment-list] TODO delete', row.id);
  }
}
