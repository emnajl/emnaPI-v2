import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../services/api.service';

import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-reserve',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './reserve.component.html',
  styleUrl: './reserve.component.css'
})
export class ReserveComponent implements OnInit {
  private readonly bufferMinutes = 30;

  rooms: any[] = [];
  equipments: any[] = [];
  reservations: any[] = [];
  reservationPreview: any | null = null;

  reservation = {
    startTime: '',
    endTime: '',
    userId: 'Etudiant01',
    room: null as any,
    equipments: [] as any[]
  };

  selectedRoomId = '';
  selectedEquipmentId = '';
  errorMessage = '';
  successMessage = '';
  previewLoading = false;

  formDateStart: Date | null = null;
  formTimeStart = '';
  formDateEnd: Date | null = null;
  formTimeEnd = '';

  constructor(
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    forkJoin({
      rooms: this.api.getRooms(),
      equipments: this.api.getEquipments(),
      reservations: this.api.getReservations()
    }).subscribe(({ rooms, equipments, reservations }) => {
      this.rooms = rooms.filter(room => room.status === 'AVAILABLE');
      this.equipments = equipments.filter(eq => eq.status === 'AVAILABLE');
      this.reservations = reservations;

      const roomId = this.route.snapshot.queryParamMap.get('roomId');
      const equipmentId = this.route.snapshot.queryParamMap.get('equipmentId');

      if (roomId && this.rooms.some(room => String(room.id) === roomId)) {
        this.selectedRoomId = roomId;
      }

      if (equipmentId && this.equipments.some(eq => String(eq.id) === equipmentId)) {
        this.selectedEquipmentId = equipmentId;
      }

      this.refreshRulePreview();
    });
  }

  get selectedRoom(): any | null {
    return this.rooms.find(room => String(room.id) === this.selectedRoomId) ?? null;
  }

  get selectedEquipment(): any | null {
    return this.equipments.find(eq => String(eq.id) === this.selectedEquipmentId) ?? null;
  }

  get requiresAdminApproval(): boolean {
    return this.reservationPreview?.requiresValidation ?? false;
  }

  get hasBlockingDecision(): boolean {
    return this.reservationPreview?.blocked ?? false;
  }

  get durationText(): string {
    const start = this.startDateTime;
    const end = this.endDateTime;

    if (!start || !end || end <= start) {
      return '--';
    }

    const diffMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    if (hours && minutes) {
      return `${hours}h ${minutes}min`;
    }

    if (hours) {
      return `${hours}h`;
    }

    return `${minutes}min`;
  }

  get startDateTime(): Date | null {
    return this.combineDateAndTime(this.formDateStart, this.formTimeStart);
  }

  get endDateTime(): Date | null {
    return this.combineDateAndTime(this.formDateEnd, this.formTimeEnd);
  }

  get matchingReservations(): any[] {
    const start = this.startDateTime;
    const end = this.endDateTime;

    if (!start || !end || (!this.selectedRoomId && !this.selectedEquipmentId)) {
      return [];
    }

    const effectiveStart = new Date(start.getTime() - this.bufferMinutes * 60000);
    const effectiveEnd = new Date(end.getTime() + this.bufferMinutes * 60000);

    return this.reservations.filter(reservation => {
      if (['REJECTED', 'CANCELLED'].includes(reservation.status)) {
        return false;
      }

      const overlaps = this.intervalsOverlap(
        effectiveStart,
        effectiveEnd,
        new Date(reservation.startTime),
        new Date(reservation.endTime)
      );

      if (!overlaps) {
        return false;
      }

      const roomConflict =
        !!this.selectedRoomId &&
        reservation.room &&
        String(reservation.room.id) === this.selectedRoomId;
      const equipmentConflict =
        !!this.selectedEquipmentId &&
        reservation.equipments?.some((eq: any) => String(eq.id) === this.selectedEquipmentId);

      return roomConflict || equipmentConflict;
    });
  }

  get suggestedSlots(): { label: string; start: Date; end: Date }[] {
    const now = new Date();
    const baseDate = this.formDateStart ?? now;
    const day = new Date(baseDate);
    day.setHours(0, 0, 0, 0);
    const slots = [
      { startHour: 8, durationHours: 2, label: 'Matin' },
      { startHour: 10, durationHours: 2, label: 'Fin de matinée' },
      { startHour: 14, durationHours: 2, label: 'Après-midi' },
      { startHour: 16, durationHours: 2, label: 'Fin de journée' }
    ];

    return slots
      .map(slot => {
        const start = new Date(day);
        start.setHours(slot.startHour, 0, 0, 0);
        const end = new Date(start);
        end.setHours(end.getHours() + slot.durationHours);
        return {
          label: slot.label,
          start,
          end
        };
      })
      .filter(slot => slot.end > now)
      .filter(slot => !this.hasConflict(slot.start, slot.end))
      .slice(0, 3);
  }

  get decisionLabel(): string {
    if (!this.reservationPreview) {
      return 'Analyse en attente';
    }

    if (this.reservationPreview.blocked) {
      return 'Bloquée';
    }

    if (this.reservationPreview.requiresValidation) {
      return 'Validation admin';
    }

    if (this.reservationPreview.autoApproved) {
      return 'Auto-approuvée';
    }

    return 'Analyse en attente';
  }

  get decisionClass(): string {
    if (!this.reservationPreview) {
      return 'decision-badge decision-badge--muted';
    }

    if (this.reservationPreview.blocked) {
      return 'decision-badge decision-badge--danger';
    }

    if (this.reservationPreview.requiresValidation) {
      return 'decision-badge decision-badge--warning';
    }

    return 'decision-badge decision-badge--success';
  }

  get startPeriodLabel(): string {
    return this.getPeriodLabel(this.formTimeStart);
  }

  get endPeriodLabel(): string {
    return this.getPeriodLabel(this.formTimeEnd);
  }

  get startTime12h(): string {
    return this.formatTimeAs12Hour(this.formTimeStart);
  }

  get endTime12h(): string {
    return this.formatTimeAs12Hour(this.formTimeEnd);
  }

  onPlanningChange() {
    this.errorMessage = '';
    this.successMessage = '';
    this.refreshRulePreview();
  }

  applySuggestedSlot(slot: { start: Date; end: Date }) {
    this.formDateStart = new Date(slot.start);
    this.formTimeStart = this.toTimeInputValue(slot.start);
    this.formDateEnd = new Date(slot.end);
    this.formTimeEnd = this.toTimeInputValue(slot.end);
    this.refreshRulePreview();
  }

  applyPreset(durationHours: number) {
    if (!this.formDateStart || !this.formTimeStart) {
      this.errorMessage = 'Choisis d’abord une date et une heure de début.';
      return;
    }

    const start = this.startDateTime;
    if (!start) {
      return;
    }

    const end = new Date(start);
    end.setHours(end.getHours() + durationHours);
    this.formDateEnd = end;
    this.formTimeEnd = this.toTimeInputValue(end);
    this.errorMessage = '';
    this.refreshRulePreview();
  }

  onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.formDateStart || !this.formTimeStart || !this.formDateEnd || !this.formTimeEnd) {
      this.errorMessage = 'Les dates et heures sont obligatoires pour la réservation.';
      return;
    }

    if (!this.selectedRoomId && !this.selectedEquipmentId) {
      this.errorMessage = 'Choisis au moins une salle ou un équipement.';
      return;
    }

    const start = this.startDateTime;
    const end = this.endDateTime;

    if (!start || !end) {
      this.errorMessage = 'Impossible d’interpréter les dates saisies.';
      return;
    }

    if (end <= start) {
      this.errorMessage = 'La date de fin doit être après la date de début.';
      return;
    }

    if (this.reservationPreview?.blocked) {
      this.errorMessage = this.reservationPreview.blockingReasons?.[0] || 'Cette réservation est bloquée par les règles métier.';
      return;
    }

    this.reservation.startTime = this.toApiDateTime(start);
    this.reservation.endTime = this.toApiDateTime(end);
    this.reservation.room = this.selectedRoomId ? { id: Number(this.selectedRoomId) } : null;
    this.reservation.equipments = this.selectedEquipmentId
      ? [{ id: Number(this.selectedEquipmentId) }]
      : [];

    this.api.createReservation(this.reservation).subscribe({
      next: res => {
        this.successMessage = res.status === 'PENDING'
          ? 'Réservation créée. Elle passera par une validation admin.'
          : 'Réservation créée et approuvée automatiquement.';
        setTimeout(() => this.router.navigate(['/emna/my-reservations']), 1800);
      },
      error: err => {
        this.errorMessage = err.error || 'Une erreur est survenue lors de la réservation.';
      }
    });
  }

  private refreshRulePreview() {
    const start = this.startDateTime;
    const end = this.endDateTime;

    if (!start || !end || (!this.selectedRoomId && !this.selectedEquipmentId)) {
      this.reservationPreview = null;
      return;
    }

    this.previewLoading = true;
    this.api.previewReservationRules({
      startTime: this.toApiDateTime(start),
      endTime: this.toApiDateTime(end),
      roomId: this.selectedRoomId ? Number(this.selectedRoomId) : null,
      equipmentIds: this.selectedEquipmentId ? [Number(this.selectedEquipmentId)] : [],
      userId: this.reservation.userId
    }).subscribe({
      next: preview => {
        this.reservationPreview = preview;
        this.previewLoading = false;
      },
      error: () => {
        this.reservationPreview = null;
        this.previewLoading = false;
      }
    });
  }

  private hasConflict(start: Date, end: Date): boolean {
    const effectiveStart = new Date(start.getTime() - this.bufferMinutes * 60000);
    const effectiveEnd = new Date(end.getTime() + this.bufferMinutes * 60000);

    return this.reservations.some(reservation => {
      if (['REJECTED', 'CANCELLED'].includes(reservation.status)) {
        return false;
      }

      const overlaps = this.intervalsOverlap(
        effectiveStart,
        effectiveEnd,
        new Date(reservation.startTime),
        new Date(reservation.endTime)
      );

      if (!overlaps) {
        return false;
      }

      const roomConflict =
        !!this.selectedRoomId &&
        reservation.room &&
        String(reservation.room.id) === this.selectedRoomId;
      const equipmentConflict =
        !!this.selectedEquipmentId &&
        reservation.equipments?.some((eq: any) => String(eq.id) === this.selectedEquipmentId);

      return roomConflict || equipmentConflict;
    });
  }

  private intervalsOverlap(
    startA: Date,
    endA: Date,
    startB: Date,
    endB: Date
  ): boolean {
    return startA < endB && endA > startB;
  }

  private combineDateAndTime(date: Date | null, time: string): Date | null {
    if (!date || !time) {
      return null;
    }

    const [hours, minutes] = time.split(':').map(Number);
    const merged = new Date(date);
    merged.setHours(hours, minutes, 0, 0);
    return merged;
  }

  private toApiDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private toTimeInputValue(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private getPeriodLabel(time: string): string {
    if (!time) {
      return '--';
    }

    const [hours] = time.split(':').map(Number);
    return hours < 12 ? 'AM - Matin' : 'PM - Après-midi';
  }

  private formatTimeAs12Hour(time: string): string {
    if (!time) {
      return '--';
    }

    const [hourPart, minutePart] = time.split(':').map(Number);
    const period = hourPart < 12 ? 'AM' : 'PM';
    const normalizedHour = hourPart % 12 === 0 ? 12 : hourPart % 12;
    return `${String(normalizedHour).padStart(2, '0')}:${String(minutePart).padStart(2, '0')} ${period}`;
  }
}
