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

import { UserDto } from '@core/models/auth.model';
import { TeacherService } from '@core/services/teacher.service';

export const LOAD_ERROR_MESSAGE =
  'No se pudieron cargar los maestros. Intenta de nuevo más tarde.';
export const TEACHER_FALLBACK = '—';

export interface TeacherRow {
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
  selector: 'app-teacher-list',
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
  ],
  templateUrl: './teacher-list.component.html',
  styleUrl: './teacher-list.component.scss',
})
export class TeacherListComponent implements OnInit, AfterViewInit {
  private readonly teacherService = inject(TeacherService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

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

  readonly rows = signal<TeacherRow[]>([]);
  readonly loading = signal(true);
  readonly filterText = signal('');

  readonly dataSource = new MatTableDataSource<TeacherRow>([]);

  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  constructor() {
    this.dataSource.filterPredicate = (row: TeacherRow, filter: string): boolean => {
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
    this.teacherService
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
          console.error('[teacher-list] failed to load', err);
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
    // TODO(FEM-*): open teacher-new dialog in a follow-up ticket.
  }

  onEdit(_row: TeacherRow): void {
    // TODO(FEM-*): open teacher-edit dialog in a follow-up ticket.
  }

  onDelete(_row: TeacherRow): void {
    // TODO(FEM-*): open teacher-delete-confirm dialog in a follow-up ticket.
  }

  private toRow(user: UserDto): TeacherRow {
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
    if (value === null || value === undefined) return TEACHER_FALLBACK;
    return value.trim().length === 0 ? TEACHER_FALLBACK : value;
  }
}
