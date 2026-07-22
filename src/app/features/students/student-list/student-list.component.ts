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
import { UserDto } from '@core/models/auth.model';
import { StudentService } from '@core/services/student.service';
import {
  ExcelExportColumn,
  ExcelExportConfig,
  ExportToExcelButtonComponent,
} from '@shared/table-export';
import {
  StudentDeleteConfirmComponent,
  StudentDeleteConfirmData,
} from '../student-delete-confirm/student-delete-confirm.component';
import { StudentEditComponent } from '../student-edit/student-edit.component';
import { StudentNewComponent } from '../student-new/student-new.component';

export const LOAD_ERROR_MESSAGE =
  'No se pudieron cargar los estudiantes. Intenta de nuevo más tarde.';
export const DELETE_SUCCESS_MESSAGE = 'Registro eliminado';
export const DELETE_ERROR_MESSAGE = 'Hubo un error con el registro';
export const STUDENT_FALLBACK = '—';

export interface StudentRow {
  id: number;
  name: string;
  parentLastName: string;
  motherLastName: string;
  email: string;
  phone: string;
  church: string;
  raw: UserDto;
}

@Component({
  selector: 'app-student-list',
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
  templateUrl: './student-list.component.html',
  styleUrl: './student-list.component.scss',
})
export class StudentListComponent implements OnInit, AfterViewInit {
  private readonly studentService = inject(StudentService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);

  readonly displayedColumns = [
    'id',
    'name',
    'parentLastName',
    'motherLastName',
    'email',
    'phone',
    'church',
    'actions',
  ];

  readonly rows = signal<StudentRow[]>([]);
  readonly loading = signal(true);
  readonly filterText = signal('');
  readonly deletingId = signal<number | null>(null);

  readonly dataSource = new MatTableDataSource<StudentRow>([]);

  readonly excelColumns: ExcelExportColumn<StudentRow>[] = [
    { header: 'ID', key: 'id', value: (r) => r.id, width: 8 },
    { header: 'Nombre(s)', key: 'name', value: (r) => this.exportCell(r.name) },
    { header: 'Paterno', key: 'parentLastName', value: (r) => this.exportCell(r.parentLastName) },
    { header: 'Materno', key: 'motherLastName', value: (r) => this.exportCell(r.motherLastName) },
    { header: 'Email', key: 'email', value: (r) => this.exportCell(r.email) },
    { header: 'Teléfono', key: 'phone', value: (r) => this.exportCell(r.phone) },
    { header: 'Iglesia', key: 'church', value: (r) => this.exportCell(r.church) },
  ];

  readonly excelConfig = (): ExcelExportConfig<StudentRow> => ({
    rows: this.dataSource.filteredData,
    columns: this.excelColumns,
    entitySlug: 'students',
    sheetName: 'Estudiantes',
    filteredBy: this.filterText(),
  });

  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  constructor() {
    this.dataSource.filterPredicate = (row: StudentRow, filter: string): boolean => {
      if (!filter) return true;
      const haystack = [
        String(row.id),
        row.name,
        row.parentLastName,
        row.motherLastName,
        row.email,
        row.phone,
        row.church,
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
    this.studentService
      .getAll()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (users) => {
          const rows = users.map((u) => this.toRow(u));
          this.rows.set(rows);
          this.dataSource.data = rows;
        },
        error: (err) => {
          console.error('[student-list] failed to load', err);
          this.snackBar.open(LOAD_ERROR_MESSAGE, 'Cerrar', {
            duration: 5000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.sort.active = 'name';
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
    const ref = this.dialog.open<StudentNewComponent, undefined, UserDto>(
      StudentNewComponent,
      {
        width: '560px',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      }
    );
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((created) => {
        if (!created) return;
        const row = this.toRow(created);
        this.rows.update((rows) => [row, ...rows]);
        this.dataSource.data = this.rows();
      });
  }

  onEdit(row: StudentRow): void {
    const ref = this.dialog.open<StudentEditComponent, { user: UserDto }, UserDto>(
      StudentEditComponent,
      {
        data: { user: row.raw },
        width: '560px',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      }
    );
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updated) => {
        if (!updated) return;
        const nextRow = this.toRow(updated);
        this.rows.update((rows) =>
          rows.map((r) => (r.id === nextRow.id ? nextRow : r))
        );
        this.dataSource.data = this.rows();
      });
  }

  onDelete(row: StudentRow): void {
    const ref = this.dialog.open<
      StudentDeleteConfirmComponent,
      StudentDeleteConfirmData,
      boolean
    >(StudentDeleteConfirmComponent, {
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
          return this.studentService.delete(row.id).pipe(
            switchMap(() => this.studentService.getAll()),
            catchError((err) => {
              console.error('[student-list] failed to delete', err);
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
      .subscribe((users) => {
        if (users === null) return;
        const rows = users.map((u) => this.toRow(u));
        this.rows.set(rows);
        this.dataSource.data = rows;
        this.snackBar.open(DELETE_SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
      });
  }

  private toRow(user: UserDto): StudentRow {
    const profile = user.profile ?? {};
    return {
      id: user.id,
      name: this.fallback(profile.name),
      parentLastName: this.fallback(profile.parentLastName),
      motherLastName: this.fallback(profile.motherLastName),
      email: this.fallback(profile.email),
      phone: this.fallback(profile.phone),
      church: this.fallback(profile.church),
      raw: user,
    };
  }

  private fallback(value: string | null | undefined): string {
    if (value === null || value === undefined) return STUDENT_FALLBACK;
    return value.trim().length === 0 ? STUDENT_FALLBACK : value;
  }

  private exportCell(value: string): string {
    return value === STUDENT_FALLBACK ? '' : value;
  }
}
