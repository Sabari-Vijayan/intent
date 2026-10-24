import { Routes } from '@angular/router';
import { creatorGuard, guestGuard, publicHomeGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/auth.component').then((m) => m.AuthComponent),
  },
  {
    path: '',
    canActivate: [publicHomeGuard],
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'forms',
    canActivate: [creatorGuard],
    loadComponent: () =>
      import('./features/forms/form-list/form-list.component').then((m) => m.FormListComponent),
  },
  {
    path: 'forms/new',
    canActivate: [creatorGuard],
    loadComponent: () =>
      import('./features/forms/form-editor/form-editor.component').then(
        (m) => m.FormEditorComponent
      ),
  },
  {
    path: 'forms/:id',
    canActivate: [creatorGuard],
    loadComponent: () =>
      import('./features/forms/form-editor/form-editor.component').then(
        (m) => m.FormEditorComponent
      ),
  },
  {
    path: 'forms/:id/responses',
    canActivate: [creatorGuard],
    loadComponent: () =>
      import('./features/responses/response-list/response-list.component').then(
        (m) => m.ResponseListComponent
      ),
  },
  {
    path: 'public/:formId',
    loadComponent: () =>
      import('./features/public/public-form/public-form.component').then(
        (m) => m.PublicFormComponent
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
