import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-admin-equipments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-equipments.component.html',
  styleUrl: './admin-equipments.component.css'
})
export class AdminEquipmentsComponent implements OnInit {
  equipments: any[] = [];
  
  eqForm: any = {
    name: '',
    type: '',
    reference: '',
    sensitive: false,
    status: 'AVAILABLE'
  };

  isEditing: boolean = false;
  editingId: number | null = null;
  message: string = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadEquipments();
  }

  loadEquipments() {
    this.api.getEquipments().subscribe(data => this.equipments = data);
  }

  saveEquipment() {
    this.message = '';
    // Jackson parse boolean either as sensitive or isSensitive depending on setup.
    // In our backend it's 'sensitive' mapped from 'isSensitive'.
    if (this.isEditing && this.editingId) {
      this.api.updateEquipment(this.editingId, this.eqForm).subscribe({
        next: () => {
          this.message = "Équipement modifié avec succès.";
          this.resetForm();
          this.loadEquipments();
        },
        error: () => this.message = "Erreur lors de la modification."
      });
    } else {
      this.api.createEquipment(this.eqForm).subscribe({
        next: () => {
          this.message = "Équipement créé avec succès.";
          this.resetForm();
          this.loadEquipments();
        },
        error: () => this.message = "Erreur lors de la création."
      });
    }
  }

  editEquipment(eq: any) {
    this.isEditing = true;
    this.editingId = eq.id;
    this.eqForm = { ...eq };
  }

  deleteEquipment(id: number) {
    if(confirm("Confirmez-vous la suppression de ce matériel ?")) {
      this.api.deleteEquipment(id).subscribe({
        next: () => this.loadEquipments(),
        error: (err) => {
          if (err.error && typeof err.error === 'string') {
            this.message = "Erreur: " + err.error;
          } else if (err.error && err.error.message) {
             this.message = "Erreur: " + err.error.message;
          } else {
             this.message = "Erreur: Impossible de supprimer l'équipement.";
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
