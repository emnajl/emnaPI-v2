import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-reservations.component.html',
  styleUrl: './my-reservations.component.css'
})
export class MyReservationsComponent implements OnInit {
  reservations: any[] = [];
  currentUserId = 'Etudiant01';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getReservations().subscribe({
      next: (data) => {
        // En vrai on filtrerait côté serveur, ici on filtre côté client pour l'exemple
        this.reservations = data.filter(r => r.userId === this.currentUserId);
      }
    });
  }

  cancelReservation(id: number) {
    if(confirm("Êtes-vous sûr de vouloir annuler ?")) {
      // Notre backend n'a pas mis le endpoint DELETE mais un PUT /cancel... on va faire un PUT ou simuler.
      // Wait, j'ai codé app.put("/{id}/cancel") dans le backend !
      this.api['http'].put(`http://localhost:8087/api/reservations/${id}/cancel`, {}).subscribe(() => {
        this.ngOnInit(); // Refresh
      });
    }
  }
}
