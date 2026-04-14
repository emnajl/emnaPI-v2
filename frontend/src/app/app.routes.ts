import { Routes } from '@angular/router';
import { ResourcesComponent } from './pages/resources/resources.component';
import { ReserveComponent } from './pages/reserve/reserve.component';
import { MyReservationsComponent } from './pages/my-reservations/my-reservations.component';
import { AdminValidationComponent } from './pages/admin-validation/admin-validation.component';
import { AdminRoomsComponent } from './pages/admin-rooms/admin-rooms.component';
import { AdminEquipmentsComponent } from './pages/admin-equipments/admin-equipments.component';

import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: 'resources', pathMatch: 'full' },
  { path: 'resources', component: ResourcesComponent },
  { path: 'reserve', component: ReserveComponent },
  { path: 'my-reservations', component: MyReservationsComponent },
  { path: 'admin/dashboard', component: AdminDashboardComponent },
  { path: 'admin/reservations', component: AdminValidationComponent },
  { path: 'admin/rooms', component: AdminRoomsComponent },
  { path: 'admin/equipments', component: AdminEquipmentsComponent }
];
