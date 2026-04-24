import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [
  {
    navCap: 'Resource Management Module',
  },
  {
    displayName: 'Admin Dashboard',
    iconName: 'layout-dashboard',
    route: '/emna/admin-dashboard',
    bgcolor: 'primary',
  },
  {
    displayName: 'Validation',
    iconName: 'checkbox',
    route: '/emna/admin-validation',
    bgcolor: 'error',
  },
  {
    displayName: 'Resources',
    iconName: 'box',
    route: '/emna/resources',
    bgcolor: 'success',
  },
  {
    displayName: 'Book',
    iconName: 'calendar-plus',
    route: '/emna/reserve',
    bgcolor: 'primary',
  },
  {
    displayName: 'My Reservations',
    iconName: 'calendar-event',
    route: '/emna/my-reservations',
    bgcolor: 'secondary',
  },
  {
    displayName: 'Rooms',
    iconName: 'building',
    route: '/emna/admin-rooms',
    bgcolor: 'warning',
  },
  {
    displayName: 'Equipment',
    iconName: 'device-desktop',
    route: '/emna/admin-equipments',
    bgcolor: 'secondary',
  },
];
