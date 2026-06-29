import { Routes } from '@angular/router';

import { authGuard, loginRedirectGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    canMatch: [loginRedirectGuard],
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canMatch: [authGuard],
    loadComponent: () => import('./features/shell/shell.component').then((m) => m.ShellComponent),
    loadChildren: () => import('./features/shell/shell.routes').then((r) => r.SHELL_ROUTES),
  },
  { path: '**', redirectTo: 'login' },
];
