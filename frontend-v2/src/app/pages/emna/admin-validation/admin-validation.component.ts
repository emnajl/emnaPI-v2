import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../../services/api.service';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-admin-validation',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './admin-validation.component.html',
  styleUrl: './admin-validation.component.css'
})
export class AdminValidationComponent implements OnInit {
  pendingReservations: any[] = [];
  errorMessage = '';
  adminId = 'ChefScolarite';
  searchTerm = '';
  priorityFilter = 'ALL';
  processingId: number | null = null;
  commentDrafts: Record<number, string> = {};

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadPendingReservations();
  }

  get filteredReservations(): any[] {
    const term = this.normalize(this.searchTerm);

    return this.pendingReservations
      .filter(reservation => {
        const matchesSearch =
          !term ||
          this.normalize(
            [
              reservation.userId,
              reservation.room?.name,
              reservation.room?.location,
              ...(reservation.equipments ?? []).map((equipment: any) => equipment.name)
            ].join(' ')
          ).includes(term);

        const matchesPriority =
          this.priorityFilter === 'ALL' ||
          this.getPriorityKey(reservation) === this.priorityFilter;

        return matchesSearch && matchesPriority;
      })
      .sort((first, second) => {
        const priorityGap = this.getPriorityScore(second) - this.getPriorityScore(first);
        if (priorityGap !== 0) {
          return priorityGap;
        }

        return new Date(first.startTime).getTime() - new Date(second.startTime).getTime();
      });
  }

  get summary() {
    return {
      total: this.pendingReservations.length,
      high: this.pendingReservations.filter(reservation => this.getPriorityKey(reservation) === 'HIGH').length,
      sensitive: this.pendingReservations.filter(reservation => this.hasSensitiveEquipment(reservation)).length,
      soon: this.pendingReservations.filter(reservation => this.startsWithin24Hours(reservation)).length
    };
  }

  loadPendingReservations(showMessage = false) {
    this.api.getReservations().subscribe({
      next: data => {
        this.pendingReservations = data.filter(reservation => reservation.status === 'PENDING');

        if (showMessage) {
          this.snackBar.open('File de validation actualisée.', 'Fermer', {
            duration: 2500
          });
        }
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement des réservations en attente.';
        this.snackBar.open(this.errorMessage, 'Fermer', {
          duration: 3500
        });
      }
    });
  }

  validate(reservation: any, action: 'APPROVED' | 'REJECTED' | 'MODIFICATION_REQUESTED') {
    this.errorMessage = '';
    const comment = (this.commentDrafts[reservation.id] || '').trim();

    if (!this.adminId.trim()) {
      this.errorMessage = "L'identifiant admin est obligatoire.";
      return;
    }

    if (action !== 'APPROVED' && !comment) {
      this.errorMessage = 'Une justification est obligatoire pour refuser ou demander une modification.';
      this.snackBar.open(this.errorMessage, 'Fermer', {
        duration: 3500
      });
      return;
    }

    this.processingId = reservation.id;
    this.api.validateReservation(reservation.id, action, this.adminId.trim(), comment).subscribe({
      next: () => {
        delete this.commentDrafts[reservation.id];
        this.processingId = null;
        this.loadPendingReservations();
        this.snackBar.open(this.getSuccessMessage(action), 'Fermer', {
          duration: 3000
        });
      },
      error: () => {
        this.processingId = null;
        this.errorMessage = 'Erreur lors de la validation. Vérifie si le backend est bien lancé.';
        this.snackBar.open(this.errorMessage, 'Fermer', {
          duration: 3500
        });
      }
    });
  }

  getPriorityLabel(reservation: any): string {
    const map: Record<string, string> = {
      HIGH: 'Priorité haute',
      MEDIUM: 'Priorité moyenne',
      LOW: 'Priorité normale'
    };

    return map[this.getPriorityKey(reservation)];
  }

  getPriorityClass(reservation: any): string {
    const map: Record<string, string> = {
      HIGH: 'priority priority--high',
      MEDIUM: 'priority priority--medium',
      LOW: 'priority priority--low'
    };

    return map[this.getPriorityKey(reservation)];
  }

  getUrgencyHint(reservation: any): string {
    if (this.startsWithin24Hours(reservation)) {
      return 'Commence dans moins de 24h';
    }

    const hours = Math.round((new Date(reservation.startTime).getTime() - Date.now()) / 3600000);
    return `Commence dans ${Math.max(hours, 0)}h`;
  }

  isBusy(reservationId: number): boolean {
    return this.processingId === reservationId;
  }

  getEquipmentsLabel(reservation: any): string {
    return (reservation.equipments ?? []).map((equipment: any) => equipment.name).join(', ');
  }

  hasSensitiveEquipment(reservation: any): boolean {
    return (reservation.equipments ?? []).some((equipment: any) => equipment.sensitive);
  }

  private getPriorityScore(reservation: any): number {
    let score = 0;

    if (this.startsWithin24Hours(reservation)) {
      score += 5;
    }

    if (reservation.room?.capacity >= 20) {
      score += 2;
    }

    if (reservation.equipments?.length > 1) {
      score += 1;
    }

    if (this.hasSensitiveEquipment(reservation)) {
      score += 4;
    }

    return score;
  }

  private getPriorityKey(reservation: any): 'HIGH' | 'MEDIUM' | 'LOW' {
    const score = this.getPriorityScore(reservation);

    if (score >= 7) {
      return 'HIGH';
    }

    if (score >= 3) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  private startsWithin24Hours(reservation: any): boolean {
    const hours = (new Date(reservation.startTime).getTime() - Date.now()) / 3600000;
    return hours >= 0 && hours <= 24;
  }

  private getSuccessMessage(action: 'APPROVED' | 'REJECTED' | 'MODIFICATION_REQUESTED'): string {
    const map: Record<string, string> = {
      APPROVED: 'Réservation approuvée.',
      REJECTED: 'Réservation refusée.',
      MODIFICATION_REQUESTED: 'Demande de modification envoyée.'
    };

    return map[action];
  }

  private normalize(value: unknown): string {
    return String(value ?? '').toLowerCase();
  }
}
