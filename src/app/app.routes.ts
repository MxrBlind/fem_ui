import { Routes } from '@angular/router';

import { loginRedirectGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    canMatch: [loginRedirectGuard],
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' }
];
