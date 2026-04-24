import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-admin-rooms',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './admin-rooms.component.html',
  styleUrl: './admin-rooms.component.css'
})
export class AdminRoomsComponent implements OnInit {
  displayedColumns: string[] = ['id', 'name', 'capacity', 'location', 'status', 'actions'];
  rooms: any[] = [];

  roomForm: any = {
    name: '',
    capacity: 0,
    location: '',
    status: 'AVAILABLE'
  };

  isEditing = false;
  editingId: number | null = null;
  message = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadRooms();
  }

  get stats() {
    return {
      total: this.rooms.length,
      available: this.rooms.filter(room => room.status === 'AVAILABLE').length,
      maintenance: this.rooms.filter(room => room.status === 'MAINTENANCE').length,
      large: this.rooms.filter(room => Number(room.capacity) >= 20).length
    };
  }

  loadRooms() {
    this.api.getRooms().subscribe(data => this.rooms = data);
  }

  saveRoom() {
    this.message = '';
    if (this.isEditing && this.editingId) {
      this.api.updateRoom(this.editingId, this.roomForm).subscribe({
        next: () => {
          this.message = 'Room updated successfully.';
          this.resetForm();
          this.loadRooms();
        },
        error: () => this.message = 'Error while updating the room.'
      });
    } else {
      this.api.createRoom(this.roomForm).subscribe({
        next: () => {
          this.message = 'Room created successfully.';
          this.resetForm();
          this.loadRooms();
        },
        error: () => this.message = 'Error while creating the room.'
      });
    }
  }

  editRoom(room: any) {
    this.isEditing = true;
    this.editingId = room.id;
    this.roomForm = { ...room };
  }

  deleteRoom(id: number) {
    if (confirm('Are you sure you want to delete this room?')) {
      this.api.deleteRoom(id).subscribe({
        next: response => {
          this.message = response?.message || 'Room deleted successfully.';
          this.loadRooms();
        },
        error: err => {
          if (err.error && typeof err.error === 'string') {
            this.message = 'Error: ' + err.error;
          } else if (err.error && err.error.message) {
            this.message = 'Error: ' + err.error.message;
          } else {
            this.message = 'Error: Unable to delete the room.';
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
