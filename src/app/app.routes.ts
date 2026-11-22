import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'dashboard/:section',
    loadComponent: () => import('./dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'mealplan',
    redirectTo: 'dashboard/mealplan',
  },
  {
    path: 'meal-plan',
    redirectTo: 'dashboard/mealplan',
  },
  {
    path: 'meal-plans',
    redirectTo: 'dashboard/mealplan',
  },
  {
    path: 'grocery',
    redirectTo: 'dashboard/grocery',
  },
  {
    path: 'groceries',
    redirectTo: 'dashboard/grocery',
  },
  {
    path: 'pantry',
    redirectTo: 'dashboard/pantry',
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
