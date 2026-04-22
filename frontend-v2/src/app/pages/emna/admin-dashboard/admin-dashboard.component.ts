import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexMarkers,
  ApexNonAxisChartSeries,
  ApexPlotOptions,
  ApexResponsive,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
  ChartComponent,
  NgApexchartsModule
} from 'ng-apexcharts';
import { ApiService } from '../../../services/api.service';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';

type PeriodFilter = '7D' | '30D' | 'ALL';

type AxisChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  dataLabels: ApexDataLabels;
  stroke: ApexStroke;
  fill: ApexFill;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  grid: ApexGrid;
  tooltip: ApexTooltip;
  legend: ApexLegend;
  plotOptions?: ApexPlotOptions;
  markers?: ApexMarkers;
  colors?: string[];
};

type DonutChartOptions = {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  labels: string[];
  legend: ApexLegend;
  dataLabels: ApexDataLabels;
  tooltip: ApexTooltip;
  responsive: ApexResponsive[];
  colors: string[];
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, NgApexchartsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  @ViewChild('loadChart') loadChartRef: ChartComponent = Object.create(null);
  @ViewChild('hourlyChart') hourlyChartRef: ChartComponent = Object.create(null);
  @ViewChild('topChart') topChartRef: ChartComponent = Object.create(null);

  period: PeriodFilter = '7D';
  allReservations: any[] = [];
  rooms: any[] = [];
  equipments: any[] = [];

  stats = {
    totalReservations: 0,
    approvedReservations: 0,
    conflictReservations: 0,
    maintenanceCount: 0,
    occupationRate: 0,
    peakHourLabel: '--'
  };

  topResources: { name: string; count: number }[] = [];

  loadChart!: Partial<AxisChartOptions>;
  hourlyChart!: Partial<AxisChartOptions>;
  topResourcesChart!: Partial<AxisChartOptions>;
  statusChart!: Partial<DonutChartOptions>;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    forkJoin({
      reservations: this.api.getReservations(),
      rooms: this.api.getRooms(),
      equipments: this.api.getEquipments()
    }).subscribe(({ reservations, rooms, equipments }) => {
      this.allReservations = reservations;
      this.rooms = rooms;
      this.equipments = equipments;
      this.refreshDashboard();
    });
  }

  setPeriod(period: PeriodFilter) {
    this.period = period;
    this.refreshDashboard();
  }

  get periodLabel(): string {
    const labels: Record<PeriodFilter, string> = {
      '7D': '7 derniers jours',
      '30D': '30 derniers jours',
      ALL: 'Historique complet'
    };

    return labels[this.period];
  }

  private refreshDashboard() {
    const reservations = this.getReservationsForPeriod();
    this.computeStats(reservations);
    this.buildLoadChart(reservations);
    this.buildHourlyChart(reservations);
    this.buildTopResources(reservations);
    this.buildStatusChart(reservations);
  }

  private getReservationsForPeriod(): any[] {
    const sortByStartDate = (reservations: any[]) =>
      [...reservations].sort(
        (first, second) => new Date(first.startTime).getTime() - new Date(second.startTime).getTime()
      );

    if (this.period === 'ALL') {
      return sortByStartDate(this.allReservations);
    }

    const days = this.period === '7D' ? 7 : 30;
    const threshold = new Date();
    threshold.setHours(0, 0, 0, 0);
    threshold.setDate(threshold.getDate() - (days - 1));

    return sortByStartDate(
      this.allReservations.filter(reservation => new Date(reservation.startTime) >= threshold)
    );
  }

  private computeStats(reservations: any[]) {
    this.stats.totalReservations = reservations.length;
    this.stats.approvedReservations = reservations.filter(reservation => reservation.status === 'APPROVED').length;
    this.stats.conflictReservations = reservations.filter(reservation =>
      ['PENDING', 'MODIFICATION_REQUESTED'].includes(reservation.status)
    ).length;
    this.stats.maintenanceCount =
      this.rooms.filter(room => room.status === 'MAINTENANCE').length +
      this.equipments.filter(equipment => equipment.status === 'MAINTENANCE').length;

    const uniqueReservedRooms = new Set(
      reservations.filter(reservation => reservation.room).map(reservation => reservation.room.id)
    ).size;
    this.stats.occupationRate = this.rooms.length
      ? Math.round((uniqueReservedRooms / this.rooms.length) * 100)
      : 0;

    const hourlyBuckets = new Array(24).fill(0);
    reservations.forEach(reservation => {
      const hour = new Date(reservation.startTime).getHours();
      hourlyBuckets[hour] += 1;
    });
    const peakHour = hourlyBuckets.indexOf(Math.max(...hourlyBuckets));
    this.stats.peakHourLabel = `${String(peakHour).padStart(2, '0')}:00`;
  }

  private buildLoadChart(reservations: any[]) {
    const buckets = new Map<string, number>();
    const order: string[] = [];

    reservations.forEach(reservation => {
      const date = new Date(reservation.startTime);
      const key = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!buckets.has(key)) {
        order.push(key);
      }
      buckets.set(key, (buckets.get(key) || 0) + 1);
    });

    this.loadChart = {
      series: [
        {
          name: 'Réservations',
          data: order.map(label => buckets.get(label) || 0)
        }
      ],
      chart: {
        type: 'area',
        height: 320,
        toolbar: { show: false },
        fontFamily: 'inherit'
      },
      colors: ['#2563eb'],
      dataLabels: { enabled: false },
      stroke: {
        curve: 'smooth',
        width: 3
      },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.28,
          opacityTo: 0.04
        }
      },
      xaxis: {
        categories: order,
        labels: {
          rotate: 0
        }
      },
      yaxis: {
        min: 0,
        forceNiceScale: true
      },
      grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 4
      },
      legend: { show: false },
      tooltip: {
        theme: 'light'
      },
      markers: {
        size: 4
      }
    };
  }

  private buildHourlyChart(reservations: any[]) {
    const hours = Array.from({ length: 12 }, (_, index) => index + 8);
    const labels = hours.map(hour => `${String(hour).padStart(2, '0')}:00`);
    const data = hours.map(hour =>
      reservations.filter(reservation => new Date(reservation.startTime).getHours() === hour).length
    );

    this.hourlyChart = {
      series: [
        {
          name: 'Demandes',
          data
        }
      ],
      chart: {
        type: 'bar',
        height: 320,
        toolbar: { show: false },
        fontFamily: 'inherit'
      },
      colors: ['#f97316'],
      dataLabels: { enabled: false },
      stroke: {
        show: true,
        width: 0
      },
      fill: {
        opacity: 1,
        type: 'solid'
      },
      plotOptions: {
        bar: {
          borderRadius: 6,
          columnWidth: '52%'
        }
      },
      xaxis: {
        categories: labels
      },
      yaxis: {
        min: 0,
        forceNiceScale: true
      },
      grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 4
      },
      legend: { show: false },
      tooltip: {
        theme: 'light'
      }
    };
  }

  private buildTopResources(reservations: any[]) {
    const resourceCounts: Record<string, number> = {};

    reservations.forEach(reservation => {
      if (reservation.room) {
        const name = reservation.room.name;
        resourceCounts[name] = (resourceCounts[name] || 0) + 1;
      }

      if (reservation.equipments?.length) {
        reservation.equipments.forEach((equipment: any) => {
          resourceCounts[equipment.name] = (resourceCounts[equipment.name] || 0) + 1;
        });
      }
    });

    this.topResources = Object.entries(resourceCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((first, second) => second.count - first.count)
      .slice(0, 5);

    this.topResourcesChart = {
      series: [
        {
          name: 'Demandes',
          data: this.topResources.map(item => item.count)
        }
      ],
      chart: {
        type: 'bar',
        height: 320,
        toolbar: { show: false },
        fontFamily: 'inherit'
      },
      colors: ['#10b981'],
      dataLabels: { enabled: false },
      stroke: {
        show: true,
        width: 0
      },
      fill: {
        opacity: 1,
        type: 'solid'
      },
      plotOptions: {
        bar: {
          borderRadius: 6,
          horizontal: true,
          barHeight: '56%'
        }
      },
      xaxis: {
        categories: this.topResources.map(item => item.name)
      },
      yaxis: {
        min: 0,
        forceNiceScale: true
      },
      grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 4
      },
      legend: { show: false },
      tooltip: {
        theme: 'light'
      }
    };
  }

  private buildStatusChart(reservations: any[]) {
    const statuses = ['APPROVED', 'PENDING', 'REJECTED', 'MODIFICATION_REQUESTED'];
    const labels = ['Approuvées', 'En attente', 'Refusées', 'Modif requise'];
    const colors = ['#10b981', '#f59e0b', '#ef4444', '#f97316'];

    this.statusChart = {
      series: statuses.map(status =>
        reservations.filter(reservation => reservation.status === status).length
      ),
      chart: {
        type: 'donut',
        height: 320,
        fontFamily: 'inherit'
      },
      labels,
      colors,
      legend: {
        position: 'bottom'
      },
      dataLabels: {
        enabled: false
      },
      tooltip: {
        theme: 'light'
      },
      responsive: [
        {
          breakpoint: 768,
          options: {
            legend: {
              position: 'bottom'
            }
          }
        }
      ]
    };
  }
}
