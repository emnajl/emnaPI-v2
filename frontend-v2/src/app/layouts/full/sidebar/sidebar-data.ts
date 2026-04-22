import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [
  {
    navCap: 'Module Gestion Des Ressources',
  },
  {
    displayName: 'Dashboard Admin',
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
    displayName: 'Ressources',
    iconName: 'box',
    route: '/emna/resources',
    bgcolor: 'success',
  },
  {
    displayName: 'Réserver',
    iconName: 'calendar-plus',
    route: '/emna/reserve',
    bgcolor: 'primary',
  },
  {
    displayName: 'Mes Réservations',
    iconName: 'calendar-event',
    route: '/emna/my-reservations',
    bgcolor: 'secondary',
  },
  {
    displayName: 'Salles',
    iconName: 'building',
    route: '/emna/admin-rooms',
    bgcolor: 'warning',
  },
  {
    displayName: 'Équipements',
    iconName: 'device-desktop',
    route: '/emna/admin-equipments',
    bgcolor: 'secondary',
  },
];
