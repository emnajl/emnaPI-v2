import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  stats = {
    totalReservations: 0,
    refusedReservations: 0,
    conflictReservations: 0,
    maintenanceCount: 0,
    occupationRate: 0
  };
  
  topResources: {name: string, count: number}[] = [];
  
  constructor(private api: ApiService) {}

  ngOnInit(): void {
    // forkJoin permet de lancer les 3 requêtes en parallèle et d'attendre leurs résultats
    forkJoin({
      reservations: this.api.getReservations(),
      rooms: this.api.getRooms(),
      equipments: this.api.getEquipments()
    }).subscribe(({ reservations, rooms, equipments }) => {
      
      // 1. Comptages de base
      this.stats.totalReservations = reservations.length;
      this.stats.refusedReservations = reservations.filter(r => r.status === 'REJECTED').length;
      
      // Conflits/Tensions : Dépendant de l'intervention humaine (PENDING, MODIFICATION_REQUESTED)
      this.stats.conflictReservations = reservations.filter(r => r.status === 'MODIFICATION_REQUESTED' || r.status === 'PENDING').length;
      
      this.stats.maintenanceCount = rooms.filter(r => r.status === 'MAINTENANCE').length 
                                  + equipments.filter(e => e.status === 'MAINTENANCE').length;
      
      // 2. Taux d'occupation global
      if (rooms.length > 0) {
        // Combien de salles uniques ont été réservées au moins une fois
        const uniqueReservedRooms = new Set(reservations.filter(r => r.room).map(r => r.room.id)).size;
        this.stats.occupationRate = Math.round((uniqueReservedRooms / rooms.length) * 100);
      }
      
      // 3. Algorithme des Ressources les plus demandées (Top 3)
      const resourceCounts: any = {};
      reservations.forEach(r => {
        if (r.room) {
          const name = "🏢 " + r.room.name;
          resourceCounts[name] = (resourceCounts[name] || 0) + 1;
        }
        if (r.equipments && r.equipments.length > 0) {
          r.equipments.forEach((eq: any) => {
            const name = "💻 " + eq.name;
            resourceCounts[name] = (resourceCounts[name] || 0) + 1;
          });
        }
      });
      
      // Transformer l'objet en tableau, le trier en décroissant, et garder les 3 premiers
      this.topResources = Object.keys(resourceCounts)
        .map(key => ({ name: key, count: resourceCounts[key] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
    });
  }
}
