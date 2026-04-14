import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-admin-rooms',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-rooms.component.html',
  styleUrl: './admin-rooms.component.css'
})
export class AdminRoomsComponent implements OnInit {
  rooms: any[] = [];
  
  roomForm: any = {
    name: '',
    capacity: 0,
    location: '',
    status: 'AVAILABLE'
  };

  isEditing: boolean = false;
  editingId: number | null = null;
  message: string = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadRooms();
  }

  loadRooms() {
    this.api.getRooms().subscribe(data => this.rooms = data);
  }

  saveRoom() {
    this.message = '';
    if (this.isEditing && this.editingId) {
      this.api.updateRoom(this.editingId, this.roomForm).subscribe({
        next: () => {
          this.message = "Salle modifiée avec succès.";
          this.resetForm();
          this.loadRooms();
        },
        error: () => this.message = "Erreur lors de la modification."
      });
    } else {
      this.api.createRoom(this.roomForm).subscribe({
        next: () => {
          this.message = "Salle créée avec succès.";
          this.resetForm();
          this.loadRooms();
        },
        error: () => this.message = "Erreur lors de la création."
      });
    }
  }

  editRoom(room: any) {
    this.isEditing = true;
    this.editingId = room.id;
    this.roomForm = { ...room };
  }

  deleteRoom(id: number) {
    if(confirm("Êtes-vous sûr de vouloir supprimer cette salle (et ses réservations existantes) ?")) {
      this.api.deleteRoom(id).subscribe({
        next: () => this.loadRooms(),
        error: (err) => {
          if (err.error && typeof err.error === 'string') {
            this.message = "Erreur: " + err.error;
          } else if (err.error && err.error.message) {
             this.message = "Erreur: " + err.error.message;
          } else {
             this.message = "Erreur: Impossible de supprimer la salle.";
          }
        }
      });
    }
  }

  resetForm() {
    this.isEditing = false;
    this.editingId = null;
    this.roomForm = { name: '', capacity: 0, location: '', status: 'AVAILABLE' };
  }
}
