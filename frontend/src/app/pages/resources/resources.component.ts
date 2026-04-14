import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-resources',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resources.component.html',
  styleUrl: './resources.component.css'
})
export class ResourcesComponent implements OnInit {
  rooms: any[] = [];
  equipments: any[] = [];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getRooms().subscribe(data => this.rooms = data);
    this.api.getEquipments().subscribe(data => this.equipments = data);
  }
}
