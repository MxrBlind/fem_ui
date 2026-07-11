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
import { finalize } from 'rxjs';

import { HasRoleDirective } from '@core/auth/has-role.directive';
import { SubjectService } from '@core/services/subject.service';
import { SubjectDto } from '@features/enrollments/models/enrollment.model';
import { SubjectNewComponent } from '../subject-new/subject-new.component';
import {
  SubjectEditComponent,
  SubjectEditDialogData,
} from '../subject-edit/subject-edit.component';

export const ADMIN_TITLE = 'Administrar materias';
export const NEW_BUTTON_LABEL = 'Nueva materia';
export const LOAD_ERROR_MESSAGE =
  'No se pudieron cargar las materias. Intenta de nuevo más tarde.';
export const SUBJECT_FALLBACK = '—';

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

  readonly dataSource = new MatTableDataSource<SubjectRow>([]);

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

  onDelete(_row: SubjectRow): void {
    // TODO(FEM-*): open subject-delete-confirm dialog once that ticket lands.
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
}
