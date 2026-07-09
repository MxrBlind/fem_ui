import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { catchError, filter, finalize, of, switchMap } from 'rxjs';

import { HasRoleDirective } from '@core/auth/has-role.directive';
import { CycleService } from '@core/services/cycle.service';
import { CycleDto } from '@features/enrollments/models/cycle.model';
import { CycleNewComponent } from '../cycle-new/cycle-new.component';
import { CycleDeleteConfirmComponent } from '../cycle-delete-confirm/cycle-delete-confirm.component';

export const LOAD_ERROR_MESSAGE =
  'No se pudieron cargar los ciclos. Intenta de nuevo más tarde.';
export const NOT_IMPLEMENTED_MESSAGE = 'Próximamente';
export const PRINCIPAL_FALLBACK = '—';
export const DELETE_SUCCESS_MESSAGE = 'Registro eliminado';
export const DELETE_ERROR_MESSAGE = 'Hubo un error con el registro';

export interface CycleRow {
  id: number;
  description: string;
  startDate: string;
  endDate: string;
  principalName: string;
  current: boolean;
  raw: CycleDto;
}

@Component({
  selector: 'app-cycle-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
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
  ],
  templateUrl: './cycle-list.component.html',
  styleUrl: './cycle-list.component.scss',
})
export class CycleListComponent implements OnInit, AfterViewInit {
  private readonly cycleService = inject(CycleService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly datePipe = new DatePipe('en-US');

  readonly displayedColumns = [
    'id',
    'description',
    'startDate',
    'endDate',
    'principalName',
    'current',
    'actions',
  ];

  readonly rows = signal<CycleRow[]>([]);
  readonly loading = signal(true);
  readonly filterText = signal('');
  readonly deletingId = signal<number | null>(null);

  readonly dataSource = new MatTableDataSource<CycleRow>([]);

  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  constructor() {
    this.dataSource.filterPredicate = (row: CycleRow, filter: string): boolean => {
      if (!filter) return true;
      const haystack = [
        String(row.id),
        row.description,
        this.datePipe.transform(row.startDate, 'mediumDate') ?? '',
        this.datePipe.transform(row.endDate, 'mediumDate') ?? '',
        row.principalName,
        row.current ? '✓' : '✕',
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
      .getAll()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (cycles) => {
          const rows = cycles.map((cycle) => this.toRow(cycle));
          this.rows.set(rows);
          this.dataSource.data = rows;
        },
        error: (err) => {
          console.error('[cycle-list] failed to load', err);
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

  onCreate(): void {
    const ref = this.dialog.open<CycleNewComponent, undefined, CycleDto>(
      CycleNewComponent,
      {
        width: '480px',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      }
    );
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((created) => {
        if (created) {
          this.reload();
        }
      });
  }

  private reload(): void {
    this.loading.set(true);
    this.cycleService
      .getAll()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (cycles) => {
          const rows = cycles.map((cycle) => this.toRow(cycle));
          this.rows.set(rows);
          this.dataSource.data = rows;
        },
        error: (err) => {
          console.error('[cycle-list] failed to reload after create', err);
          this.snackBar.open(LOAD_ERROR_MESSAGE, 'Cerrar', {
            duration: 5000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  onEdit(row: CycleRow): void {
    console.debug('[cycle-list] onEdit not implemented yet', row.id);
    this.showNotImplemented();
  }

  onDelete(row: CycleRow): void {
    const ref = this.dialog.open<CycleDeleteConfirmComponent, { row: CycleRow }, boolean>(
      CycleDeleteConfirmComponent,
      {
        width: '420px',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        data: { row },
      }
    );

    ref
      .afterClosed()
      .pipe(
        filter((confirmed): confirmed is true => confirmed === true),
        switchMap(() => {
          this.deletingId.set(row.id);
          return this.cycleService.delete(row.id).pipe(
            switchMap(() => this.cycleService.getAll()),
            catchError((err) => {
              console.error('[cycle-list] failed to delete', err);
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
      .subscribe((cycles) => {
        if (cycles === null) return;
        const rows = cycles.map((cycle) => this.toRow(cycle));
        this.rows.set(rows);
        this.dataSource.data = rows;
        this.snackBar.open(DELETE_SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
      });
  }

  private showNotImplemented(): void {
    this.snackBar.open(NOT_IMPLEMENTED_MESSAGE, 'Cerrar', { duration: 3000 });
  }

  private toRow(cycle: CycleDto): CycleRow {
    return {
      id: cycle.id ?? 0,
      description: cycle.description,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      principalName: this.composePrincipalName(cycle),
      current: cycle.current ?? false,
      raw: cycle,
    };
  }

  private composePrincipalName(cycle: CycleDto): string {
    const profile = cycle.principal?.profile;
    if (!profile) return PRINCIPAL_FALLBACK;
    const name = (profile.name ?? '').trim();
    const parent = (profile.parentLastName ?? '').trim();
    const full = `${name} ${parent}`.trim();
    return full.length > 0 ? full : PRINCIPAL_FALLBACK;
  }
}
