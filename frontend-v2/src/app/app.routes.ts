import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';

export const routes: Routes = [
  {
    path: '',
    component: FullComponent,
    children: [
      {
        path: '',
        redirectTo: '/emna/admin-dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        redirectTo: '/emna/admin-dashboard',
        pathMatch: 'full',
      },
      {
        path: 'emna',
        loadChildren: () =>
          import('./pages/emna/emna.routes').then((m) => m.EmnaRoutes),
      },
    ],
  },
  {
    path: '',
    component: BlankComponent,
    children: [
      {
        path: 'authentication',
        loadChildren: () =>
          import('./pages/authentication/authentication.routes').then(
            (m) => m.AuthenticationRoutes
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/emna/admin-dashboard',
  },
];
