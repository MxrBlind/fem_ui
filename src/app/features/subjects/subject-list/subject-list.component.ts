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
import { SubjectService } from '@core/services/subject.service';
import { SubjectDto } from '@features/enrollments/models/enrollment.model';
import {
  ExcelExportColumn,
  ExcelExportConfig,
  ExportToExcelButtonComponent,
} from '@shared/table-export';
import { SubjectNewComponent } from '../subject-new/subject-new.component';
import {
  SubjectEditComponent,
  SubjectEditDialogData,
} from '../subject-edit/subject-edit.component';
import {
  SubjectDeleteConfirmComponent,
  SubjectDeleteConfirmData,
} from '../subject-delete-confirm/subject-delete-confirm.component';

export const ADMIN_TITLE = 'Administrar materias';
export const NEW_BUTTON_LABEL = 'Nueva materia';
export const LOAD_ERROR_MESSAGE =
  'No se pudieron cargar las materias. Intenta de nuevo más tarde.';
export const SUBJECT_FALLBACK = '—';
export const DELETE_SUCCESS_MESSAGE = 'Registro eliminado';
export const DELETE_ERROR_MESSAGE = 'Hubo un error con el registro';

export interface SubjectRow {
  id: number;
  code: string;
  description: string;
  category: string;
  level: string;
  raw: SubjectDto;
}

@Component({
  selector: 'app-subject-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HasRoleDirective,
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
    ExportToExcelButtonComponent,
  ],
  templateUrl: './subject-list.component.html',
  styleUrl: './subject-list.component.scss',
})
export class SubjectListComponent implements OnInit, AfterViewInit {
  private readonly subjectService = inject(SubjectService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);

  readonly title = ADMIN_TITLE;
  readonly newButtonLabel = NEW_BUTTON_LABEL;

  readonly displayedColumns = ['id', 'description', 'category', 'level', 'actions'];

  readonly rows = signal<SubjectRow[]>([]);
  readonly loading = signal(true);
  readonly filterText = signal('');
  readonly deletingId = signal<number | null>(null);

  readonly dataSource = new MatTableDataSource<SubjectRow>([]);

  readonly excelColumns: ExcelExportColumn<SubjectRow>[] = [
    { header: 'ID', key: 'id', value: (r) => r.id, width: 8 },
    { header: 'Nombre', key: 'description', value: (r) => this.exportCell(r.description) },
    { header: 'Categoría', key: 'category', value: (r) => this.exportCell(r.category) },
    { header: 'Nivel', key: 'level', value: (r) => this.exportCell(r.level) },
  ];

  readonly excelConfig = (): ExcelExportConfig<SubjectRow> => ({
    rows: this.dataSource.filteredData,
    columns: this.excelColumns,
    entitySlug: 'subjects',
    sheetName: 'Materias',
    filteredBy: this.filterText(),
  });

  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  constructor() {
    this.dataSource.filterPredicate = (row: SubjectRow, filter: string): boolean => {
      if (!filter) return true;
      const haystack = [String(row.id), row.code, row.description, row.category, row.level]
        .join(' ')
        .toLowerCase();
      return haystack.includes(filter);
    };

    effect(() => {
      this.dataSource.filter = this.filterText().trim().toLowerCase();
    });
  }

  ngOnInit(): void {
    this.subjectService
      .list()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (subjects) => {
          const rows = subjects.map((s) => this.toRow(s));
          this.rows.set(rows);
          this.dataSource.data = rows;
        },
        error: (err) => {
          console.error('[subject-list] failed to load', err);
          this.snackBar.open(LOAD_ERROR_MESSAGE, 'Cerrar', {
            duration: 5000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.sort.active = 'description';
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
    const ref = this.dialog.open<SubjectNewComponent, undefined, SubjectDto | undefined>(
      SubjectNewComponent,
      {
        width: '480px',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        disableClose: true,
      }
    );
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((dto) => {
        if (!dto) return;
        this.reload();
      });
  }

  private reload(): void {
    this.loading.set(true);
    this.subjectService
      .list()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (subjects) => {
          const rows = subjects.map((s) => this.toRow(s));
          this.rows.set(rows);
          this.dataSource.data = rows;
        },
        error: (err) => {
          console.error('[subject-list] failed to load', err);
          this.snackBar.open(LOAD_ERROR_MESSAGE, 'Cerrar', {
            duration: 5000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  onEdit(row: SubjectRow): void {
    const ref = this.dialog.open<
      SubjectEditComponent,
      SubjectEditDialogData,
      SubjectDto | undefined
    >(SubjectEditComponent, {
      data: { subject: row.raw },
      width: '480px',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      disableClose: true,
    });
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((dto) => {
        if (!dto) return;
        this.reload();
      });
  }

  onDelete(row: SubjectRow): void {
    const ref = this.dialog.open<
      SubjectDeleteConfirmComponent,
      SubjectDeleteConfirmData,
      boolean
    >(SubjectDeleteConfirmComponent, {
      data: { row },
      width: '420px',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });

    ref
      .afterClosed()
      .pipe(
        filter((confirmed): confirmed is true => confirmed === true),
        switchMap(() => {
          this.deletingId.set(row.id);
          return this.subjectService.delete(row.id).pipe(
            switchMap(() => this.subjectService.list()),
            catchError((err) => {
              console.error('[subject-list] failed to delete', err);
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
      .subscribe((subjects) => {
        if (subjects === null) return;
        const rows = subjects.map((s) => this.toRow(s));
        this.rows.set(rows);
        this.dataSource.data = rows;
        this.snackBar.open(DELETE_SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
      });
  }

  private toRow(subject: SubjectDto): SubjectRow {
    return {
      id: subject.id ?? 0,
      code: this.fallback(subject.code),
      description: this.fallback(subject.description),
      category: this.fallback(subject.category?.title),
      level: this.fallback(subject.level?.title),
      raw: subject,
    };
  }

  private fallback(value: string | null | undefined): string {
    if (value === null || value === undefined) return SUBJECT_FALLBACK;
    return value.trim().length === 0 ? SUBJECT_FALLBACK : value;
  }

  private exportCell(value: string): string {
    return value === SUBJECT_FALLBACK ? '' : value;
  }
}
