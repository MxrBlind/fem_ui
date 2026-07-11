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

import { CategoryService } from '@core/services/category.service';
import { LevelService } from '@core/services/level.service';
import { SubjectService } from '@core/services/subject.service';
import {
  CategoryDto,
  CreateSubjectRequest,
  LevelDto,
  SubjectDto,
} from '@features/enrollments/models/enrollment.model';

export const SUCCESS_MESSAGE = 'Registro creado exitosamente';
export const ERROR_MESSAGE = 'Error al crear este registro';
export const LOAD_ERROR_MESSAGE = 'No se pudieron cargar los datos del formulario';

interface LoadResult {
  categories: CategoryDto[];
  levels: LevelDto[];
}

@Component({
  selector: 'app-subject-new',
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
  templateUrl: './subject-new.component.html',
  styleUrl: './subject-new.component.scss',
})
export class SubjectNewComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  private readonly levelService = inject(LevelService);
  private readonly subjectService = inject(SubjectService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(MatDialogRef<SubjectNewComponent, SubjectDto>);

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);

  readonly categories = signal<CategoryDto[]>([]);
  readonly levels = signal<LevelDto[]>([]);

  readonly categorySearch = signal('');
  readonly levelSearch = signal('');

  readonly filteredCategories = computed(() => {
    const q = this.categorySearch().trim().toLowerCase();
    const list = this.categories();
    if (!q) return list;
    return list.filter((c) => this.displayCategory(c).toLowerCase().includes(q));
  });

  readonly filteredLevels = computed(() => {
    const q = this.levelSearch().trim().toLowerCase();
    const list = this.levels();
    if (!q) return list;
    return list.filter((l) => this.displayLevel(l).toLowerCase().includes(q));
  });

  readonly form = this.fb.nonNullable.group({
    code: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    description: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    categoryId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    levelId: new FormControl<number | null>(null, { validators: [Validators.required] }),
  });

  ngOnInit(): void {
    this.form.disable();
    forkJoin({
      categories: this.categoryService.list(),
      levels: this.levelService.list(),
    })
      .pipe(
        catchError((err: unknown) => {
          console.error('[subject-new] failed to load form data', err);
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
        this.categories.set(result.categories);
        this.levels.set(result.levels);
        this.form.enable();
      });
  }

  displayCategory(cat: CategoryDto | null | undefined): string {
    return cat?.title ?? '';
  }

  displayLevel(lvl: LevelDto | null | undefined): string {
    return lvl?.title ?? '';
  }

  displayCategoryById = (id: number | null): string => {
    if (id == null) return '';
    const cat = this.categories().find((c) => c.id === id);
    return cat ? this.displayCategory(cat) : '';
  };

  displayLevelById = (id: number | null): string => {
    if (id == null) return '';
    const lvl = this.levels().find((l) => l.id === id);
    return lvl ? this.displayLevel(lvl) : '';
  };

  onCategoryInput(value: string): void {
    this.categorySearch.set(value);
    if (this.form.controls.categoryId.value != null) {
      const selected = this.categories().find(
        (c) => c.id === this.form.controls.categoryId.value
      );
      if (!selected || this.displayCategory(selected) !== value) {
        this.form.controls.categoryId.setValue(null);
      }
    }
  }

  onLevelInput(value: string): void {
    this.levelSearch.set(value);
    if (this.form.controls.levelId.value != null) {
      const selected = this.levels().find(
        (l) => l.id === this.form.controls.levelId.value
      );
      if (!selected || this.displayLevel(selected) !== value) {
        this.form.controls.levelId.setValue(null);
      }
    }
  }

  onCategorySelected(cat: CategoryDto): void {
    if (cat.id == null) return;
    this.form.controls.categoryId.setValue(cat.id);
    this.categorySearch.set(this.displayCategory(cat));
  }

  onLevelSelected(lvl: LevelDto): void {
    if (lvl.id == null) return;
    this.form.controls.levelId.setValue(lvl.id);
    this.levelSearch.set(this.displayLevel(lvl));
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving() || this.loading() || this.loadFailed()) return;

    const { code, description, categoryId, levelId } = this.form.getRawValue();
    if (categoryId == null || levelId == null) return;

    const payload: CreateSubjectRequest = {
      code,
      description,
      category: { id: categoryId },
      level: { id: levelId },
    };

    this.saving.set(true);
    this.form.disable();

    this.subjectService
      .create(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dto) => {
          this.snackBar.open(SUCCESS_MESSAGE, 'Cerrar', { duration: 3000 });
          this.dialogRef.close(dto);
        },
        error: (err: unknown) => {
          console.error('[subject-new] failed to create subject', err);
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
