import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./features/auth/auth.component').then((m) => m.AuthComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'forms/new',
    loadComponent: () =>
      import('./features/forms/form-editor/form-editor.component').then(
        (m) => m.FormEditorComponent
      ),
  },
  {
    path: 'forms/:id',
    loadComponent: () =>
      import('./features/forms/form-editor/form-editor.component').then(
        (m) => m.FormEditorComponent
      ),
  },
  {
    path: 'forms/:id/responses',
    loadComponent: () =>
      import('./features/responses/response-list/response-list.component').then(
        (m) => m.ResponseListComponent
      ),
  },
  {
    path: 'public/:slug',
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
