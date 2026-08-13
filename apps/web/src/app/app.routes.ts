import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login').then((m) => m.LoginComponent) },
  {
    path: '',
    loadComponent: () => import('./shell/app-shell/app-shell').then((m) => m.AppShellComponent),
    canActivate: [authGuard],
    children: [{ path: '', loadComponent: () => import('./features/home/home').then((m) => m.HomeComponent) }],
  },
  { path: '**', redirectTo: '' },
];
