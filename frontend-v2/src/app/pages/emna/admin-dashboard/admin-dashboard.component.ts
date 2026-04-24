import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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

type RecentActivityItem = {
  title: string;
  meta: string;
  statusLabel: string;
  statusClass: string;
};

type HealthCard = {
  label: string;
  caption: string;
  value: string;
  className: string;
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MaterialModule, TablerIconsModule, NgApexchartsModule],
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
    peakHourLabel: '--',
    approvalRate: 0,
    pendingRate: 0,
    averageDurationLabel: '--',
    resourceCoverageRate: 0,
    busiestDayLabel: 'No demand yet',
    sensitiveAssets: 0
  };

  topResources: { name: string; count: number }[] = [];
  recentActivity: RecentActivityItem[] = [];
  healthCards: HealthCard[] = [];

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
      '7D': 'Last 7 days',
      '30D': 'Last 30 days',
      ALL: 'Full history'
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
    this.buildRecentActivity(reservations);
    this.buildHealthCards();
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
    const approvedCount = reservations.filter(reservation => reservation.status === 'APPROVED').length;
    const pendingCount = reservations.filter(reservation =>
      ['PENDING', 'MODIFICATION_REQUESTED'].includes(reservation.status)
    ).length;

    this.stats.totalReservations = reservations.length;
    this.stats.approvedReservations = approvedCount;
    this.stats.conflictReservations = pendingCount;
    this.stats.approvalRate = this.toPercent(approvedCount, reservations.length);
    this.stats.pendingRate = this.toPercent(pendingCount, reservations.length);
    this.stats.maintenanceCount =
      this.rooms.filter(room => room.status === 'MAINTENANCE').length +
      this.equipments.filter(equipment => equipment.status === 'MAINTENANCE').length;
    this.stats.sensitiveAssets = this.equipments.filter(equipment => equipment.sensitive).length;

    const uniqueReservedRooms = new Set(
      reservations.filter(reservation => reservation.room).map(reservation => reservation.room.id)
    ).size;
    this.stats.occupationRate = this.toPercent(uniqueReservedRooms, this.rooms.length);

    const uniqueResources = new Set<string>();
    reservations.forEach(reservation => {
      if (reservation.room?.id) {
        uniqueResources.add(`room-${reservation.room.id}`);
      }

      reservation.equipments?.forEach((equipment: any) => {
        if (equipment.id) {
          uniqueResources.add(`equipment-${equipment.id}`);
        }
      });
    });
    this.stats.resourceCoverageRate = this.toPercent(uniqueResources.size, this.rooms.length + this.equipments.length);

    const hourlyBuckets = new Array(24).fill(0);
    const dayBuckets = new Map<string, number>();
    let totalDurationMinutes = 0;
    let validDurationCount = 0;

    reservations.forEach(reservation => {
      const startDate = new Date(reservation.startTime);
      const endDate = new Date(reservation.endTime);
      const hour = startDate.getHours();
      hourlyBuckets[hour] += 1;

      const dayLabel = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      dayBuckets.set(dayLabel, (dayBuckets.get(dayLabel) || 0) + 1);

      const duration = (endDate.getTime() - startDate.getTime()) / 60000;
      if (Number.isFinite(duration) && duration > 0) {
        totalDurationMinutes += duration;
        validDurationCount += 1;
      }
    });

    const peakValue = Math.max(...hourlyBuckets);
    const peakHour = peakValue > 0 ? hourlyBuckets.indexOf(peakValue) : -1;
    this.stats.peakHourLabel = peakHour >= 0 ? `${String(peakHour).padStart(2, '0')}:00` : '--';

    const busiestDay = [...dayBuckets.entries()].sort((first, second) => second[1] - first[1])[0];
    this.stats.busiestDayLabel = busiestDay ? `${busiestDay[0]} with ${busiestDay[1]} request(s)` : 'No demand yet';
    this.stats.averageDurationLabel = validDurationCount
      ? this.formatDuration(Math.round(totalDurationMinutes / validDurationCount))
      : '--';
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
          name: 'Reservations',
          data: order.map(label => buckets.get(label) || 0)
        }
      ],
      chart: {
        type: 'area',
        height: 350,
        toolbar: { show: false },
        fontFamily: 'inherit',
        sparkline: { enabled: false }
      },
      colors: ['#2563eb'],
      dataLabels: { enabled: false },
      stroke: {
        curve: 'smooth',
        width: 4
      },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.34,
          opacityTo: 0.03
        }
      },
      xaxis: {
        categories: order,
        labels: {
          rotate: 0,
          style: { colors: '#64748b' }
        },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        min: 0,
        forceNiceScale: true,
        labels: { style: { colors: '#64748b' } }
      },
      grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 5,
        padding: { left: 12, right: 16 }
      },
      legend: { show: false },
      tooltip: {
        theme: 'light',
        y: { formatter: value => `${value} request(s)` }
      },
      markers: {
        size: 5,
        strokeWidth: 3,
        strokeColors: '#fff'
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
          name: 'Requests',
          data
        }
      ],
      chart: {
        type: 'bar',
        height: 300,
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
          borderRadius: 9,
          columnWidth: '48%'
        }
      },
      xaxis: {
        categories: labels,
        labels: { style: { colors: '#64748b' } },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        min: 0,
        forceNiceScale: true,
        labels: { style: { colors: '#64748b' } }
      },
      grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 5
      },
      legend: { show: false },
      tooltip: {
        theme: 'light',
        y: { formatter: value => `${value} request(s)` }
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
      .slice(0, 6);

    this.topResourcesChart = {
      series: [
        {
          name: 'Requests',
          data: this.topResources.map(item => item.count)
        }
      ],
      chart: {
        type: 'bar',
        height: 300,
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
          borderRadius: 9,
          horizontal: true,
          barHeight: '52%'
        }
      },
      xaxis: {
        categories: this.topResources.map(item => item.name),
        labels: { style: { colors: '#64748b' } }
      },
      yaxis: {
        min: 0,
        forceNiceScale: true,
        labels: { style: { colors: '#475569' } }
      },
      grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 5
      },
      legend: { show: false },
      tooltip: {
        theme: 'light',
        y: { formatter: value => `${value} request(s)` }
      }
    };
  }

  private buildStatusChart(reservations: any[]) {
    const statuses = ['APPROVED', 'PENDING', 'REJECTED', 'MODIFICATION_REQUESTED'];
    const labels = ['Approved', 'Pending', 'Rejected', 'Needs changes'];
    const colors = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

    this.statusChart = {
      series: statuses.map(status =>
        reservations.filter(reservation => reservation.status === status).length
      ),
      chart: {
        type: 'donut',
        height: 300,
        fontFamily: 'inherit'
      },
      labels,
      colors,
      legend: {
        position: 'bottom',
        fontSize: '13px',
        labels: { colors: '#475569' }
      },
      dataLabels: {
        enabled: true,
        formatter: value => `${Math.round(Number(value))}%`,
        style: { fontWeight: '700' }
      },
      tooltip: {
        theme: 'light',
        y: { formatter: value => `${value} request(s)` }
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

  private buildRecentActivity(reservations: any[]) {
    this.recentActivity = [...reservations]
      .sort((first, second) => new Date(second.startTime).getTime() - new Date(first.startTime).getTime())
      .slice(0, 5)
      .map(reservation => ({
        title: reservation.room?.name || reservation.equipments?.[0]?.name || 'Resource reservation',
        meta: `${reservation.userId || 'User'} - ${this.formatDateTime(reservation.startTime)}`,
        statusLabel: this.getStatusLabel(reservation.status),
        statusClass: `activity-status activity-status--${this.getStatusTone(reservation.status)}`
      }));
  }

  private buildHealthCards() {
    const totalResources = this.rooms.length + this.equipments.length;
    const availableResources =
      this.rooms.filter(room => room.status === 'AVAILABLE').length +
      this.equipments.filter(equipment => equipment.status === 'AVAILABLE').length;

    this.healthCards = [
      {
        label: 'Available resources',
        caption: `${availableResources} of ${totalResources} can be booked`,
        value: `${this.toPercent(availableResources, totalResources)}%`,
        className: 'health-value health-value--good'
      },
      {
        label: 'Validation pressure',
        caption: 'Pending and change requests',
        value: `${this.stats.pendingRate}%`,
        className: this.stats.pendingRate > 35 ? 'health-value health-value--warn' : 'health-value health-value--good'
      },
      {
        label: 'Maintenance impact',
        caption: 'Blocked resources',
        value: `${this.stats.maintenanceCount}`,
        className: this.stats.maintenanceCount > 0 ? 'health-value health-value--warn' : 'health-value health-value--good'
      }
    ];
  }

  private toPercent(value: number, total: number): number {
    return total ? Math.round((value / total) * 100) : 0;
  }

  private formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours && remainingMinutes) {
      return `${hours}h ${remainingMinutes}m`;
    }

    return hours ? `${hours}h` : `${remainingMinutes}m`;
  }

  private formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'No date';
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ` at ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      APPROVED: 'Approved',
      PENDING: 'Pending',
      REJECTED: 'Rejected',
      CANCELLED: 'Cancelled',
      MODIFICATION_REQUESTED: 'Needs changes'
    };

    return labels[status] || status || 'Unknown';
  }

  private getStatusTone(status: string): string {
    const tones: Record<string, string> = {
      APPROVED: 'success',
      PENDING: 'warning',
      REJECTED: 'danger',
      CANCELLED: 'muted',
      MODIFICATION_REQUESTED: 'info'
    };

    return tones[status] || 'muted';
  }
}
