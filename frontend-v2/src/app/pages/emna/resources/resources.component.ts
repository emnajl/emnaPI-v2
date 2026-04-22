import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../services/api.service';

import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-resources',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './resources.component.html',
  styleUrl: './resources.component.css'
})
export class ResourcesComponent implements OnInit {
  rooms: any[] = [];
  equipments: any[] = [];
  searchTerm = '';
  roomStatusFilter = 'ALL';
  equipmentStatusFilter = 'ALL';
  selectedType = 'ALL';
  minimumCapacity = 0;
  sensitiveOnly = false;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.api.getRooms().subscribe(data => this.rooms = data);
    this.api.getEquipments().subscribe(data => this.equipments = data);
  }

  get roomTypesSummary() {
    return {
      total: this.rooms.length,
      available: this.rooms.filter(room => room.status === 'AVAILABLE').length,
      maintenance: this.rooms.filter(room => room.status === 'MAINTENANCE').length,
      large: this.rooms.filter(room => Number(room.capacity) >= 20).length
    };
  }

  get equipmentSummary() {
    return {
      total: this.equipments.length,
      available: this.equipments.filter(eq => eq.status === 'AVAILABLE').length,
      sensitive: this.equipments.filter(eq => eq.sensitive).length,
      maintenance: this.equipments.filter(eq => eq.status === 'MAINTENANCE').length
    };
  }

  get equipmentTypes(): string[] {
    return [...new Set(this.equipments.map(eq => eq.type).filter(Boolean))].sort();
  }

  get filteredRooms(): any[] {
    const term = this.normalized(this.searchTerm);

    return this.rooms.filter(room => {
      const matchesTerm =
        !term ||
        this.normalized(room.name).includes(term) ||
        this.normalized(room.location).includes(term);
      const matchesStatus =
        this.roomStatusFilter === 'ALL' || room.status === this.roomStatusFilter;
      const matchesCapacity = Number(room.capacity || 0) >= this.minimumCapacity;

      return matchesTerm && matchesStatus && matchesCapacity;
    });
  }

  get filteredEquipments(): any[] {
    const term = this.normalized(this.searchTerm);

    return this.equipments.filter(eq => {
      const matchesTerm =
        !term ||
        this.normalized(eq.name).includes(term) ||
        this.normalized(eq.type).includes(term) ||
        this.normalized(eq.reference).includes(term);
      const matchesStatus =
        this.equipmentStatusFilter === 'ALL' || eq.status === this.equipmentStatusFilter;
      const matchesType = this.selectedType === 'ALL' || eq.type === this.selectedType;
      const matchesSensitivity = !this.sensitiveOnly || !!eq.sensitive;

      return matchesTerm && matchesStatus && matchesType && matchesSensitivity;
    });
  }

  reserveRoom(roomId: number) {
    this.router.navigate(['/emna/reserve'], {
      queryParams: { roomId }
    });
  }

  reserveEquipment(equipmentId: number) {
    this.router.navigate(['/emna/reserve'], {
      queryParams: { equipmentId }
    });
  }

  resetFilters() {
    this.searchTerm = '';
    this.roomStatusFilter = 'ALL';
    this.equipmentStatusFilter = 'ALL';
    this.selectedType = 'ALL';
    this.minimumCapacity = 0;
    this.sensitiveOnly = false;
  }

  private normalized(value: unknown): string {
    return String(value ?? '').toLowerCase();
  }
}
