import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-reserve',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reserve.component.html',
  styleUrl: './reserve.component.css'
})
export class ReserveComponent implements OnInit {
  rooms: any[] = [];
  equipments: any[] = [];
  
  reservation = {
    startTime: '',
    endTime: '',
    userId: 'Etudiant01', // Simulation d'un user connecté
    room: null as any,
    equipments: [] as any[]
  };

  selectedRoomId: string = '';
  selectedEquipmentId: string = '';
  errorMessage: string = '';
  successMessage: string = '';

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.api.getRooms().subscribe(data => this.rooms = data.filter(r => r.status === 'AVAILABLE'));
    this.api.getEquipments().subscribe(data => this.equipments = data.filter(e => e.status === 'AVAILABLE'));
  }

  onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.reservation.startTime || !this.reservation.endTime) {
      this.errorMessage = "Les dates sont obligatoires.";
      return;
    }

    if (!this.selectedRoomId && !this.selectedEquipmentId) {
      this.errorMessage = "Vous devez choisir soit une salle, soit un équipement, soit les deux.";
      return;
    }

    if (this.selectedRoomId) {
      this.reservation.room = { id: Number(this.selectedRoomId) };
    } else {
      this.reservation.room = null;
    }

    if (this.selectedEquipmentId) {
      this.reservation.equipments = [{ id: Number(this.selectedEquipmentId) }];
    } else {
      this.reservation.equipments = [];
    }

    this.api.createReservation(this.reservation).subscribe({
      next: (res) => {
        this.successMessage = "Réservation créée avec succès ! En attente de validation.";
        setTimeout(() => this.router.navigate(['/my-reservations']), 2000);
      },
      error: (err) => {
        this.errorMessage = err.error || "Une erreur est survenue lors de la réservation (Conflit).";
      }
    });
  }
}
