import { Routes } from '@angular/router';
import { ResourcesComponent } from './resources/resources.component';
import { ReserveComponent } from './reserve/reserve.component';
import { MyReservationsComponent } from './my-reservations/my-reservations.component';
import { AdminValidationComponent } from './admin-validation/admin-validation.component';
import { AdminRoomsComponent } from './admin-rooms/admin-rooms.component';
import { AdminEquipmentsComponent } from './admin-equipments/admin-equipments.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';

export const EmnaRoutes: Routes = [
  { path: 'resources', component: ResourcesComponent },
  { path: 'reserve', component: ReserveComponent },
  { path: 'my-reservations', component: MyReservationsComponent },
  { path: 'admin-validation', component: AdminValidationComponent },
  { path: 'admin-rooms', component: AdminRoomsComponent },
  { path: 'admin-equipments', component: AdminEquipmentsComponent },
  { path: 'admin-dashboard', component: AdminDashboardComponent },
];
