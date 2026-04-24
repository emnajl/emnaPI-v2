import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-admin-equipments',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './admin-equipments.component.html',
  styleUrl: './admin-equipments.component.css'
})
export class AdminEquipmentsComponent implements OnInit {
  displayedColumns: string[] = ['id', 'name', 'type', 'sensitive', 'status', 'actions'];
  equipments: any[] = [];

  eqForm: any = {
    name: '',
    type: '',
    reference: '',
    sensitive: false,
    status: 'AVAILABLE'
  };

  isEditing = false;
  editingId: number | null = null;
  message = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadEquipments();
  }

  get stats() {
    return {
      total: this.equipments.length,
      available: this.equipments.filter(eq => eq.status === 'AVAILABLE').length,
      sensitive: this.equipments.filter(eq => eq.sensitive).length,
      maintenance: this.equipments.filter(eq => eq.status === 'MAINTENANCE').length
    };
  }

  loadEquipments() {
    this.api.getEquipments().subscribe(data => this.equipments = data);
  }

  saveEquipment() {
    this.message = '';
    if (this.isEditing && this.editingId) {
      this.api.updateEquipment(this.editingId, this.eqForm).subscribe({
        next: () => {
          this.message = 'Equipment updated successfully.';
          this.resetForm();
          this.loadEquipments();
        },
        error: () => this.message = 'Error while updating the equipment.'
      });
    } else {
      this.api.createEquipment(this.eqForm).subscribe({
        next: () => {
          this.message = 'Equipment created successfully.';
          this.resetForm();
          this.loadEquipments();
        },
        error: () => this.message = 'Error while creating the equipment.'
      });
    }
  }

  editEquipment(eq: any) {
    this.isEditing = true;
    this.editingId = eq.id;
    this.eqForm = { ...eq };
  }

  deleteEquipment(id: number) {
    if (confirm('Do you confirm deleting this equipment?')) {
      this.api.deleteEquipment(id).subscribe({
        next: response => {
          this.message = response?.message || 'Equipment deleted successfully.';
          this.loadEquipments();
        },
        error: err => {
          if (err.error && typeof err.error === 'string') {
            this.message = 'Error: ' + err.error;
          } else if (err.error && err.error.message) {
            this.message = 'Error: ' + err.error.message;
          } else {
            this.message = 'Error: Unable to delete the equipment.';
          }
        }
      });
    }
  }

  resetForm() {
    this.isEditing = false;
    this.editingId = null;
    this.eqForm = { name: '', type: '', reference: '', sensitive: false, status: 'AVAILABLE' };
  }
}
