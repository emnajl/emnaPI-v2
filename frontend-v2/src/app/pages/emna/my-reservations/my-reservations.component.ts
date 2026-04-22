import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { interval, Subscription } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../../services/api.service';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-my-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './my-reservations.component.html',
  styleUrl: './my-reservations.component.css'
})
export class MyReservationsComponent implements OnInit, OnDestroy {
  reservations: any[] = [];
  currentUserId = 'Etudiant01';
  searchTerm = '';
  statusFilter = 'ALL';
  sortMode = 'RECENT';
  now = Date.now();
  private clockSubscription?: Subscription;

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadReservations();
    this.clockSubscription = interval(60000).subscribe(() => {
      this.now = Date.now();
    });
  }

  ngOnDestroy(): void {
    this.clockSubscription?.unsubscribe();
  }

  get filteredReservations(): any[] {
    const term = this.normalize(this.searchTerm);
    const items = this.reservations.filter(reservation => {
      const workflowStatus = reservation.status ?? '';
      const liveState = this.getLiveStateKey(reservation);
      const resourceText = [
        reservation.room?.name,
        ...(reservation.equipments ?? []).map((equipment: any) => equipment.name),
        reservation.validationComment,
        reservation.userId
      ]
        .filter(Boolean)
        .join(' ');

      const matchesTerm = !term || this.normalize(resourceText).includes(term);
      const matchesStatus =
        this.statusFilter === 'ALL' ||
        workflowStatus === this.statusFilter ||
        liveState === this.statusFilter;

      return matchesTerm && matchesStatus;
    });

    return items.sort((first, second) => {
      if (this.sortMode === 'OLDEST') {
        return new Date(first.startTime).getTime() - new Date(second.startTime).getTime();
      }

      if (this.sortMode === 'STATUS') {
        return this.getStatusPriority(second.status) - this.getStatusPriority(first.status);
      }

      return new Date(second.startTime).getTime() - new Date(first.startTime).getTime();
    });
  }

  get counts() {
    return {
      total: this.reservations.length,
      active: this.reservations.filter(reservation => this.getLiveStateKey(reservation) === 'ACTIVE').length,
      pending: this.reservations.filter(reservation => reservation.status === 'PENDING').length,
      attention: this.reservations.filter(reservation => reservation.status === 'MODIFICATION_REQUESTED').length
    };
  }

  loadReservations(showMessage = false) {
    this.api.getReservations().subscribe({
      next: data => {
        this.reservations = data.filter(reservation => reservation.userId === this.currentUserId);
        this.now = Date.now();

        if (showMessage) {
          this.snackBar.open('Réservations mises à jour.', 'Fermer', {
            duration: 2500
          });
        }
      },
      error: () => {
        this.snackBar.open('Impossible de charger les réservations.', 'Fermer', {
          duration: 3500
        });
      }
    });
  }

  cancelReservation(id: number) {
    this.api.cancelReservation(id).subscribe({
      next: () => {
        this.loadReservations();
        this.snackBar.open('Réservation annulée avec succès.', 'Fermer', {
          duration: 3000
        });
      },
      error: () => {
        this.snackBar.open("L'annulation a échoué.", 'Fermer', {
          duration: 3500
        });
      }
    });
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      APPROVED: 'Approuvée',
      PENDING: 'En attente',
      REJECTED: 'Refusée',
      CANCELLED: 'Annulée',
      MODIFICATION_REQUESTED: 'Modification requise'
    };

    return map[status] ?? status;
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      APPROVED: 'badge badge--success',
      PENDING: 'badge badge--warning',
      REJECTED: 'badge badge--danger',
      CANCELLED: 'badge badge--muted',
      MODIFICATION_REQUESTED: 'badge badge--attention'
    };

    return map[status] ?? 'badge badge--muted';
  }

  getLiveStateLabel(reservation: any): string {
    const map: Record<string, string> = {
      UPCOMING: 'À venir',
      ACTIVE: 'En cours',
      COMPLETED: 'Terminée'
    };

    return map[this.getLiveStateKey(reservation)];
  }

  getLiveStateClass(reservation: any): string {
    const map: Record<string, string> = {
      UPCOMING: 'badge badge--info',
      ACTIVE: 'badge badge--success',
      COMPLETED: 'badge badge--muted'
    };

    return map[this.getLiveStateKey(reservation)];
  }

  getTimeHint(reservation: any): string {
    const start = new Date(reservation.startTime).getTime();
    const end = new Date(reservation.endTime).getTime();
    const diffToStartMinutes = Math.round((start - this.now) / 60000);
    const diffToEndMinutes = Math.round((end - this.now) / 60000);

    if (this.getLiveStateKey(reservation) === 'ACTIVE') {
      return `Se termine dans ${this.formatMinutes(diffToEndMinutes)}.`;
    }

    if (this.getLiveStateKey(reservation) === 'UPCOMING') {
      return `Commence dans ${this.formatMinutes(diffToStartMinutes)}.`;
    }

    return `Terminée depuis ${this.formatMinutes(Math.abs(diffToEndMinutes))}.`;
  }

  canCancel(reservation: any): boolean {
    return !['CANCELLED', 'REJECTED'].includes(reservation.status);
  }

  getEquipmentsLabel(reservation: any): string {
    return (reservation.equipments ?? []).map((equipment: any) => equipment.name).join(', ');
  }

  private getLiveStateKey(reservation: any): 'UPCOMING' | 'ACTIVE' | 'COMPLETED' {
    const start = new Date(reservation.startTime).getTime();
    const end = new Date(reservation.endTime).getTime();

    if (this.now < start) {
      return 'UPCOMING';
    }

    if (this.now > end) {
      return 'COMPLETED';
    }

    return 'ACTIVE';
  }

  private getStatusPriority(status: string): number {
    const priorities: Record<string, number> = {
      MODIFICATION_REQUESTED: 5,
      PENDING: 4,
      APPROVED: 3,
      CANCELLED: 2,
      REJECTED: 1
    };

    return priorities[status] ?? 0;
  }

  private formatMinutes(totalMinutes: number): string {
    const minutes = Math.max(totalMinutes, 0);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours && remainingMinutes) {
      return `${hours}h ${remainingMinutes}min`;
    }

    if (hours) {
      return `${hours}h`;
    }

    return `${remainingMinutes}min`;
  }

  private normalize(value: unknown): string {
    return String(value ?? '').toLowerCase();
  }
}
