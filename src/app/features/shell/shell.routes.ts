import { Routes } from '@angular/router';

import { roleGuard } from '@core/auth/auth.guards';

export const SHELL_ROUTES: Routes = [
  {
    path: 'dashboard',
    canMatch: [roleGuard],
    data: { roles: ['admin', 'principal'] },
    loadComponent: () =>
      import('../dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'courses',
    canMatch: [roleGuard],
    data: { roles: ['admin', 'teacher'] },
    loadComponent: () => import('../courses/courses.component').then((m) => m.CoursesComponent),
  },
  {
    path: 'grades',
    canMatch: [roleGuard],
    data: { roles: ['student'] },
    loadComponent: () => import('../grades/grades.component').then((m) => m.GradesComponent),
  },
  {
    path: 'inscripciones',
    canMatch: [roleGuard],
    data: { roles: ['admin', 'teacher'] },
    loadComponent: () =>
      import('../enrollments/enrollment-list/enrollment-list.component').then(
        (m) => m.EnrollmentListComponent
      ),
  },
  {
    path: 'ciclo-actual',
    canMatch: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('../current-cycle/current-cycle-list/current-cycle-list.component').then(
        (m) => m.CurrentCycleListComponent
      ),
  },
];
