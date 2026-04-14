import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-admin-validation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-validation.component.html',
  styleUrl: './admin-validation.component.css'
})
export class AdminValidationComponent implements OnInit {
  pendingReservations: any[] = [];
  errorMessage = '';
  // Par défaut, l'utilisateur d'administration est simulé
  adminId = 'ChefScolarite';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getReservations().subscribe({
      next: (data) => {
        this.pendingReservations = data.filter(r => r.status === 'PENDING');
      }
    });
  }

  validate(id: number, action: string) {
    this.errorMessage = '';
    let comment = '';
    
    if (action !== 'APPROVED') {
      const msgPrompt = action === 'REJECTED' ? "Motif de refus" : "Détails de la modification demandée";
      comment = prompt(`${msgPrompt} (obligatoire) :`) || '';
      if (!comment.trim()) {
        this.errorMessage = "Une justification est obligatoire pour cette action.";
        return;
      }
    }

    this.api.validateReservation(id, action, this.adminId, comment).subscribe({
      next: () => {
        this.ngOnInit(); // Refresh list
      },
      error: (err) => {
        this.errorMessage = "Erreur lors de la validation. Vérifiez si le backend est bien lancé.";
      }
    });
  }
}
