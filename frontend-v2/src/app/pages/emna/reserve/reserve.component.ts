import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../services/api.service';

import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';

type BookingSignal = {
  label: string;
  tone: 'info' | 'warning' | 'danger' | 'success';
};

type ConflictCard = {
  title: string;
  subtitle: string;
  status: string;
};

@Component({
  selector: 'app-reserve',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './reserve.component.html',
  styleUrl: './reserve.component.css'
})
export class ReserveComponent implements OnInit {
  private readonly bufferMinutes = 30;
  private readonly businessHourStart = 8;
  private readonly businessHourEnd = 18;
  private readonly longDurationThresholdHours = 4;

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
  aiPrompt = '';
  aiLoading = false;
  aiResult: any | null = null;

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
      this.rooms = [...rooms].sort((first, second) => String(first.name).localeCompare(String(second.name)));
      this.equipments = [...equipments].sort((first, second) => String(first.name).localeCompare(String(second.name)));
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

  get hasSelectedResource(): boolean {
    return !!this.selectedRoomId || !!this.selectedEquipmentId;
  }

  get hasCompleteSchedule(): boolean {
    return !!this.startDateTime && !!this.endDateTime;
  }

  get requiresAdminApproval(): boolean {
    return this.reservationPreview?.requiresValidation ?? false;
  }

  get hasBlockingDecision(): boolean {
    return this.reservationPreview?.blocked ?? false;
  }

  get canSubmit(): boolean {
    return !this.previewLoading && !this.hasBlockingDecision && this.hasSelectedResource && this.hasCompleteSchedule;
  }

  get durationMinutes(): number | null {
    const start = this.startDateTime;
    const end = this.endDateTime;

    if (!start || !end || end <= start) {
      return null;
    }

    return Math.round((end.getTime() - start.getTime()) / 60000);
  }

  get durationText(): string {
    const diffMinutes = this.durationMinutes;
    if (!diffMinutes) {
      return '--';
    }

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

  get isLongDuration(): boolean {
    return (this.durationMinutes ?? 0) > this.longDurationThresholdHours * 60;
  }

  get isWeekendBooking(): boolean {
    const start = this.startDateTime;
    if (!start) {
      return false;
    }

    const day = start.getDay();
    return day === 0 || day === 6;
  }

  get isOutsideBusinessHours(): boolean {
    const start = this.startDateTime;
    const end = this.endDateTime;

    if (!start || !end) {
      return false;
    }

    return start.getHours() < this.businessHourStart || end.getHours() >= this.businessHourEnd;
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

    if (!start || !end || !this.hasSelectedResource) {
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

  get conflictCards(): ConflictCard[] {
    return this.matchingReservations.map(reservation => {
      const roomConflict =
        !!this.selectedRoomId &&
        reservation.room &&
        String(reservation.room.id) === this.selectedRoomId;
      const equipmentNames = (reservation.equipments ?? [])
        .filter((equipment: any) => String(equipment.id) === this.selectedEquipmentId)
        .map((equipment: any) => equipment.name);

      const titleParts: string[] = [];
      if (roomConflict) {
        titleParts.push(`Room ${reservation.room.name}`);
      }
      if (equipmentNames.length > 0) {
        titleParts.push(...equipmentNames.map(name => `Equipment ${name}`));
      }

      return {
        title: titleParts.join(' + ') || 'Conflicting reservation',
        subtitle: `${this.formatDateTime(reservation.startTime)} -> ${this.formatTimeAs12HourFromDate(reservation.endTime)} (buffer included)`,
        status: this.getReservationStatusLabel(reservation.status)
      };
    });
  }

  get decisionLabel(): string {
    if (!this.reservationPreview) {
      return 'Waiting for analysis';
    }

    if (this.reservationPreview.blocked) {
      return 'Blocked';
    }

    if (this.reservationPreview.requiresValidation) {
      return 'Admin validation';
    }

    if (this.reservationPreview.autoApproved) {
      return 'Auto-approved';
    }

    return 'Waiting for analysis';
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

  get stateTitle(): string {
    if (!this.hasSelectedResource) {
      return 'Choose a room or equipment';
    }

    if (!this.hasCompleteSchedule) {
      return 'Add start and end times';
    }

    if (this.previewLoading) {
      return 'Checking business rules';
    }

    if (this.hasBlockingDecision) {
      return 'This booking cannot be created';
    }

    if (this.requiresAdminApproval) {
      return 'This booking needs admin review';
    }

    if (this.reservationPreview?.autoApproved) {
      return 'This booking can be approved automatically';
    }

    return 'Ready to continue';
  }

  get stateDescription(): string {
    if (!this.hasSelectedResource) {
      return 'The system needs at least one target resource before it can analyze the booking.';
    }

    if (!this.hasCompleteSchedule) {
      return 'As soon as date and time are complete, the page will explain the decision clearly.';
    }

    if (this.previewLoading) {
      return 'The rule engine is checking conflicts, maintenance, blocked dates and validation rules.';
    }

    if (this.hasBlockingDecision) {
      return 'One or more hard constraints stop the booking: maintenance, blocked period, existing reservation or unavailable resource.';
    }

    if (this.requiresAdminApproval) {
      return 'The booking is possible, but a human decision is required before final approval.';
    }

    if (this.reservationPreview?.autoApproved) {
      return 'No blocking rule and no extra validation rule were detected.';
    }

    return 'The booking form is ready.';
  }

  get nextStepText(): string {
    if (!this.hasSelectedResource || !this.hasCompleteSchedule) {
      return 'Complete the form to unlock a real-time decision.';
    }

    if (this.hasBlockingDecision) {
      return 'Change the resource, date or time, or choose one of the suggested conflict-free slots.';
    }

    if (this.requiresAdminApproval) {
      return 'You can submit now. The reservation will be saved as Pending for admin review.';
    }

    return 'You can submit now. The reservation should be approved automatically.';
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

  get selectedRoomStatusLabel(): string {
    return this.getResourceStatusLabel(this.selectedRoom?.status);
  }

  get selectedEquipmentStatusLabel(): string {
    return this.getResourceStatusLabel(this.selectedEquipment?.status);
  }

  get selectedRoomStatusClass(): string {
    return this.getResourceStatusClass(this.selectedRoom?.status);
  }

  get selectedEquipmentStatusClass(): string {
    return this.getResourceStatusClass(this.selectedEquipment?.status);
  }

  get triggeredSignals(): BookingSignal[] {
    const signals: BookingSignal[] = [];

    if (this.selectedRoom?.capacity >= 20) {
      signals.push({ label: 'Large room selected', tone: 'warning' });
    }

    if (this.selectedEquipment?.sensitive) {
      signals.push({ label: 'Sensitive equipment selected', tone: 'danger' });
    }

    if (this.isLongDuration) {
      signals.push({ label: 'Long duration over 4 hours', tone: 'warning' });
    }

    if (this.isOutsideBusinessHours) {
      signals.push({ label: 'Outside standard business hours', tone: 'warning' });
    }

    if (this.isWeekendBooking) {
      signals.push({ label: 'Weekend booking', tone: 'warning' });
    }

    if (this.matchingReservations.length > 0) {
      signals.push({ label: `${this.matchingReservations.length} conflict(s) found`, tone: 'danger' });
    }

    if (signals.length === 0 && this.hasCompleteSchedule && this.hasSelectedResource) {
      signals.push({ label: 'No alert detected yet', tone: 'success' });
    }

    return signals;
  }

  get aiConfidenceClass(): string {
    const confidence = Number(this.aiResult?.confidence ?? 0);
    if (confidence >= 75) {
      return 'ai-confidence ai-confidence--high';
    }
    if (confidence >= 50) {
      return 'ai-confidence ai-confidence--medium';
    }
    return 'ai-confidence ai-confidence--low';
  }

  get suggestedSlots(): { label: string; start: Date; end: Date }[] {
    const now = new Date();
    const baseDate = this.formDateStart ?? now;
    const day = new Date(baseDate);
    day.setHours(0, 0, 0, 0);
    const slots = [
      { startHour: 8, durationHours: 2, label: 'Morning' },
      { startHour: 10, durationHours: 2, label: 'Late morning' },
      { startHour: 14, durationHours: 2, label: 'Afternoon' },
      { startHour: 16, durationHours: 2, label: 'End of day' }
    ];

    return slots
      .map(slot => {
        const start = new Date(day);
        start.setHours(slot.startHour, 0, 0, 0);
        const end = new Date(start);
        end.setHours(end.getHours() + slot.durationHours);
        return {
          label: `${slot.label} - ${this.formatTimeAs12Hour(this.toTimeInputValue(start))}`,
          start,
          end
        };
      })
      .filter(slot => slot.end > now)
      .filter(slot => !this.hasConflict(slot.start, slot.end))
      .slice(0, 3);
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
      this.errorMessage = 'Choose a start date and time first.';
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

  askAiAssistant() {
    const prompt = this.aiPrompt.trim();
    if (!prompt) {
      this.errorMessage = 'Describe your need first, for example: tomorrow morning, 25 students, projector.';
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.aiLoading = true;

    this.api.askReservationAssistant(prompt).subscribe({
      next: result => {
        this.aiResult = result;
        this.aiLoading = false;
      },
      error: error => {
        this.aiLoading = false;
        if (error.status === 404) {
          this.errorMessage = 'AI endpoint not found. Restart the Spring Boot backend so it loads the new AI assistant.';
          return;
        }

        if (error.status === 0) {
          this.errorMessage = 'Backend is not reachable on port 8087. Start Spring Boot, then try Ask AI again.';
          return;
        }

        this.errorMessage = 'The AI assistant could not analyze the request. Check the backend console for details.';
      }
    });
  }

  applyAiSuggestion() {
    if (!this.aiResult) {
      return;
    }

    this.selectedRoomId = this.aiResult.roomId ? String(this.aiResult.roomId) : '';
    this.selectedEquipmentId = this.aiResult.equipmentId ? String(this.aiResult.equipmentId) : '';

    const start = new Date(this.aiResult.suggestedStartTime);
    const end = new Date(this.aiResult.suggestedEndTime);

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      this.formDateStart = start;
      this.formTimeStart = this.toTimeInputValue(start);
      this.formDateEnd = end;
      this.formTimeEnd = this.toTimeInputValue(end);
    }

    this.successMessage = 'AI suggestion applied. The business-rule engine is now checking the final decision.';
    this.refreshRulePreview();
  }

  onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.formDateStart || !this.formTimeStart || !this.formDateEnd || !this.formTimeEnd) {
      this.errorMessage = 'Dates and times are required for the reservation.';
      return;
    }

    if (!this.selectedRoomId && !this.selectedEquipmentId) {
      this.errorMessage = 'Choose at least one room or one piece of equipment.';
      return;
    }

    const start = this.startDateTime;
    const end = this.endDateTime;

    if (!start || !end) {
      this.errorMessage = 'The selected dates could not be interpreted.';
      return;
    }

    if (end <= start) {
      this.errorMessage = 'The end date must be after the start date.';
      return;
    }

    if (this.reservationPreview?.blocked) {
      this.errorMessage = this.translateRuleText(this.reservationPreview.blockingReasons?.[0]) ||
        'This reservation is blocked by the business rules.';
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
          ? 'Reservation created. It will go through admin validation.'
          : 'Reservation created and automatically approved.';
        setTimeout(() => this.router.navigate(['/emna/my-reservations']), 1800);
      },
      error: err => {
        this.errorMessage = typeof err.error === 'string'
          ? this.translateRuleText(err.error)
          : 'An error occurred while creating the reservation.';
      }
    });
  }

  translateRuleText(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) {
      return '';
    }

    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (normalized.includes('periode bloquee') || normalized.includes('general_maintenance')) {
      return 'This date falls inside a blocked period such as maintenance, holiday, exam or special event.';
    }

    if (normalized.includes('salle est indisponible') || normalized.includes('salle est indisponible ou en maintenance')) {
      return 'The selected room is unavailable or under maintenance.';
    }

    if (normalized.includes("l'equipement") && normalized.includes('indisponible')) {
      return 'The selected equipment is unavailable or under maintenance.';
    }

    if (normalized.includes('deja reservee sur ce creneau')) {
      return 'The selected room is already booked for this time slot, including the preparation buffer.';
    }

    if (normalized.includes('deja reserve avec temps tampon')) {
      return 'The selected equipment is already booked for this time slot, including the preparation buffer.';
    }

    if (normalized.includes('jour ferie')) {
      return 'This date is a public holiday.';
    }

    if (normalized.includes('examen')) {
      return 'This slot is blocked for exam sessions.';
    }

    if (normalized.includes('evenement')) {
      return 'This slot is blocked for a special event.';
    }

    if (normalized.includes('grande salle')) {
      return 'Large room selected: admin validation is required.';
    }

    if (normalized.includes('materiel') && normalized.includes('sensible')) {
      return 'Sensitive equipment selected: admin validation is required.';
    }

    if (normalized.includes('hors horaires')) {
      return 'The booking is outside standard business hours, so admin validation is required.';
    }

    if (normalized.includes('duree depasse') || normalized.includes('duree depasse 4 heures') || normalized.includes('4 heures')) {
      return 'The duration is longer than 4 hours, so admin validation is required.';
    }

    if (normalized.includes('tampon')) {
      return 'A 30-minute preparation and cleanup buffer is applied before and after the reservation.';
    }

    return text;
  }

  private refreshRulePreview() {
    const start = this.startDateTime;
    const end = this.endDateTime;

    if (!start || !end || !this.hasSelectedResource) {
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

  private getResourceStatusLabel(status: string | undefined): string {
    const labels: Record<string, string> = {
      AVAILABLE: 'Available',
      MAINTENANCE: 'Maintenance',
      UNAVAILABLE: 'Unavailable'
    };

    return labels[status ?? ''] || 'Unknown';
  }

  private getResourceStatusClass(status: string | undefined): string {
    const labels: Record<string, string> = {
      AVAILABLE: 'resource-state resource-state--success',
      MAINTENANCE: 'resource-state resource-state--warning',
      UNAVAILABLE: 'resource-state resource-state--danger'
    };

    return labels[status ?? ''] || 'resource-state resource-state--muted';
  }

  private getReservationStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      APPROVED: 'Approved',
      PENDING: 'Pending',
      REJECTED: 'Rejected',
      CANCELLED: 'Cancelled',
      MODIFICATION_REQUESTED: 'Needs changes'
    };

    return labels[status] || status || 'Unknown';
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
    return hours < 12 ? 'AM / Morning' : 'PM / Afternoon';
  }

  private formatDateTime(value: string): string {
    const date = new Date(value);
    const dateLabel = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    return `${dateLabel} ${this.formatTimeAs12HourFromDate(date)}`;
  }

  private formatTimeAs12HourFromDate(date: Date | string): string {
    const actualDate = typeof date === 'string' ? new Date(date) : date;
    return this.formatTimeAs12Hour(
      `${String(actualDate.getHours()).padStart(2, '0')}:${String(actualDate.getMinutes()).padStart(2, '0')}`
    );
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
