import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, map, of, switchMap } from 'rxjs';
import { BookingRecord } from '../../core/models/booking.model';
import { EventItem } from '../../core/models/event.model';
import { AuthService } from '../../core/services/auth.service';
import { BookingService } from '../../core/services/booking.service';
import { EventService } from '../../core/services/event.service';
import { DashboardMetrics, DashboardMetricsService } from '../../core/services/dashboard-metrics.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';
import { CurrencyGtqPipe } from '../../shared/pipes/currency-gtq.pipe';

interface MetricCard {
  label: string;
  value: string;
  detail: string;
  icon: string;
}

interface ChartPoint {
  label: string;
  key?: string;
  value: number;
  display: string;
  percent: number;
}

interface EventSalesRow {
  event: EventItem;
  sold: number;
  available: number;
  revenue: number;
  progress: number;
}

interface SalesDashboardVm {
  metrics: MetricCard[];
  dailySales: ChartPoint[];
  paymentMethods: ChartPoint[];
  eventRows: EventSalesRow[];
  recentBookings: BookingRecord[];
  totalRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  visibleEvents: EventItem[];
  allEvents: EventItem[];
  currentEventsCount: number;
  hasFilters: boolean;
}

interface DashboardFilters {
  eventId: string;
  category: string;
  period: 'all' | 'today' | 'week' | 'month';
  paymentMethods: string[];
}

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, RouterLink, CurrencyGtqPipe, ...MATERIAL_IMPORTS],
  template: `
    <section class="sales-dashboard">
      <div class="sales-hero">
        <div>
          <p class="eyebrow">Dashboard general</p>
          <h1>Ventas y entradas</h1>
          <p>Resumen operativo para ingresos, disponibilidad, ventas por dia y metodos de pago.</p>
        </div>
        <div class="hero-actions">
          <a mat-flat-button color="primary" routerLink="/dashboard/ventas-efectivo">
            <mat-icon>point_of_sale</mat-icon>
            Venta en efectivo
          </a>
          <a mat-stroked-button routerLink="/dashboard/eventos">
            <mat-icon>event_note</mat-icon>
            Gestionar eventos
          </a>
        </div>
      </div>

      <ng-container *ngIf="vm$ | async as vm">
        <section class="filter-panel" aria-label="Filtros del dashboard">
          <div class="filter-title">
            <span class="filter-icon"><mat-icon>filter_alt</mat-icon></span>
            <div>
              <strong>Panel de análisis</strong>
              <small>{{ vm.hasFilters ? 'Vista filtrada' : 'Mostrando eventos actuales' }}</small>
            </div>
          </div>

          <label>
            <span>Evento</span>
            <select [value]="filters.eventId" (change)="setFilter('eventId', $event)">
              <option value="all">Todos los eventos actuales</option>
              @for (event of vm.allEvents; track event.id) {
                <option [value]="event.id">{{ event.name }}</option>
              }
            </select>
          </label>

          <label>
            <span>Categoría</span>
            <select [value]="filters.category" (change)="setFilter('category', $event)">
              <option value="all">Todas</option>
              @for (category of categories(vm.allEvents); track category) {
                <option [value]="category">{{ category }}</option>
              }
            </select>
          </label>

          <label>
            <span>Periodo de ventas</span>
            <select [value]="filters.period" (change)="setFilter('period', $event)">
              <option value="all">Todo el historial</option>
              <option value="today">Hoy</option>
              <option value="week">Últimos 7 días</option>
              <option value="month">Últimos 30 días</option>
            </select>
          </label>

          <div class="custom-multiselect-group" (click)="$event.stopPropagation()">
            <span>Método de pago</span>
            <button
              type="button"
              class="multiselect-trigger"
              (click)="togglePaymentMenu($event)"
              [class.is-open]="isPaymentMenuOpen"
              [attr.aria-expanded]="isPaymentMenuOpen"
            >
              <span class="trigger-text">{{ paymentMethodsDisplayText }}</span>
              <mat-icon class="trigger-arrow">{{ isPaymentMenuOpen ? 'arrow_drop_up' : 'arrow_drop_down' }}</mat-icon>
            </button>

            @if (isPaymentMenuOpen) {
              <div class="multiselect-dropdown">
                <div class="multiselect-actions">
                  <button type="button" class="btn-text-action" (click)="selectAllPaymentMethods()">Todos</button>
                  <span class="action-divider">·</span>
                  <button type="button" class="btn-text-action" (click)="clearPaymentMethods()">Limpiar</button>
                </div>
                <div class="multiselect-options">
                  @for (opt of paymentOptions; track opt.value) {
                    <label class="multiselect-option" (click)="$event.stopPropagation()">
                      <input
                        type="checkbox"
                        [checked]="isPaymentSelected(opt.value)"
                        (change)="togglePaymentMethod(opt.value)"
                      />
                      <span>{{ opt.label }}</span>
                    </label>
                  }
                </div>
              </div>
            }
          </div>

          <button type="button" class="clear-filter" [disabled]="!vm.hasFilters" (click)="clearFilters()">
            <mat-icon>restart_alt</mat-icon>
            Restablecer
          </button>
        </section>

        <div class="report-status">
          <span><i></i> Datos actualizados desde el servidor</span>
          <strong>{{ vm.visibleEvents.length }} de {{ vm.currentEventsCount }} eventos vigentes</strong>
        </div>

        <div class="metric-grid">
          @for (metric of vm.metrics; track metric.label) {
            <article class="metric-card">
              <div class="metric-icon">
                <mat-icon>{{ metric.icon }}</mat-icon>
              </div>
              <div>
                <span>{{ metric.label }}</span>
                <strong>{{ metric.value }}</strong>
                <p>{{ metric.detail }}</p>
              </div>
            </article>
          }
        </div>

        <div class="dashboard-grid">
          <section class="dashboard-card chart-card">
            <div class="card-head">
              <div>
                <p class="eyebrow">Comportamiento</p>
                <h2>Ventas por día</h2>
              </div>
              <span class="badge">Últimos 7 días</span>
            </div>

            <div class="bar-chart daily">
              @for (point of vm.dailySales; track point.label) {
                <div class="bar-item">
                  <strong class="bar-value">{{ point.display }}</strong>
                  <div class="bar-track">
                    <span [style.height.%]="point.percent"></span>
                  </div>
                  <small>{{ point.label }}</small>
                </div>
              }
            </div>
          </section>

          <section class="dashboard-card methods-card">
            <div class="card-head">
              <div>
                <p class="eyebrow">Distribución</p>
                <h2>Métodos de pago</h2>
              </div>
              <span class="badge">Aprobados</span>
            </div>

            <div class="payment-list">
              @for (point of vm.paymentMethods; track point.label) {
                <button
                  type="button"
                  class="payment-row"
                  [class.is-selected]="point.key ? isPaymentSelected(point.key) : false"
                  (click)="point.key && filterByPayment(point.key)"
                >
                  <div class="payment-label">
                    <strong>{{ point.label }}</strong>
                    <span>{{ point.display }}</span>
                  </div>
                  <div class="progress-track">
                    <span [style.width.%]="point.percent"></span>
                  </div>
                  <small>{{ point.percent }}%</small>
                </button>
              }
            </div>
          </section>

          <section class="dashboard-card events-card">
            <div class="card-head">
              <div>
                <p class="eyebrow">Rendimiento</p>
                <h2>Ventas por evento</h2>
              </div>
              <a mat-button color="primary" routerLink="/dashboard/eventos">Ver cartelera</a>
            </div>

            <div class="event-sales-list">
              @for (row of vm.eventRows; track row.event.id) {
                <article class="event-sales-row">
                  <div>
                    <strong>{{ row.event.name }}</strong>
                    <p>{{ row.event.category }} · {{ row.event.date | date:'dd MMM yyyy' }}</p>
                  </div>
                  <div>
                    <div class="event-progress">
                      <span [style.width.%]="row.progress"></span>
                    </div>
                    <small>{{ row.sold }} vendidas · {{ row.available }} disponibles</small>
                  </div>
                  <strong class="event-revenue">{{ row.revenue | currencyGtq }}</strong>
                </article>
              }
            </div>
          </section>

          <section class="dashboard-card recent-card">
            <div class="card-head">
              <div>
                <p class="eyebrow">Actividad</p>
                <h2>Ventas recientes</h2>
              </div>
              <a mat-button color="primary" routerLink="/dashboard/reservaciones">Ver todas</a>
            </div>

            <div class="recent-list">
              @for (booking of vm.recentBookings; track booking.id) {
                <article class="recent-row">
                  <div>
                    <strong>{{ booking.orderNumber }}</strong>
                    <p>{{ booking.eventName }} · {{ booking.paymentMethod }}</p>
                  </div>
                  <div>
                    <strong>{{ booking.totals.total | currencyGtq }}</strong>
                    <small>{{ booking.createdAt | date:'short' }}</small>
                  </div>
                </article>
              }
            </div>
          </section>
        </div>
      </ng-container>
    </section>
  `,
  styles: [`
    .sales-dashboard {
      display: grid;
      gap: 24px;
    }

    .sales-hero {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      padding: 28px 32px;
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(106, 0, 255, 0.08), rgba(255, 77, 0, 0.08));
      border: 1px solid var(--surface-border);
    }

    .sales-hero h1 {
      margin: 4px 0 8px;
      font-size: 2rem;
      font-weight: 800;
    }

    .sales-hero p {
      margin: 0;
      color: var(--text-muted);
    }

    .hero-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .filter-panel {
      display: grid;
      grid-template-columns: minmax(180px, auto) repeat(4, minmax(140px, 1fr)) auto;
      gap: 12px;
      align-items: center;
      padding: 16px 20px;
      border-radius: 16px;
      background: #ffffff;
      border: 1px solid var(--surface-border);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
    }

    .filter-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .filter-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--brand-gradient);
      color: #ffffff;
    }

    .filter-title strong {
      display: block;
      font-size: 0.95rem;
      font-weight: 700;
    }

    .filter-title small {
      color: var(--text-muted);
      font-size: 0.78rem;
    }

    .filter-panel label {
      display: grid;
      gap: 5px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #64748b;
    }

    .filter-panel select {
      height: 42px;
      padding: 0 12px;
      border-radius: 10px;
      border: 1.5px solid #d5dded;
      background: #ffffff;
      font-size: 0.88rem;
      font-weight: 600;
      color: #0f172a;
      outline: none;
      transition: border-color 0.2s;
      cursor: pointer;
    }

    .filter-panel select:focus {
      border-color: #004489;
    }

    .custom-multiselect-group {
      position: relative;
      display: grid;
      gap: 5px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #64748b;
    }

    .multiselect-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 42px;
      padding: 0 12px;
      border-radius: 10px;
      border: 1.5px solid #d5dded;
      background: #ffffff;
      font-size: 0.88rem;
      font-weight: 600;
      color: #0f172a;
      cursor: pointer;
      text-transform: none;
      letter-spacing: normal;
      transition: border-color 0.2s;
      width: 100%;
      text-align: left;
    }

    .multiselect-trigger:hover,
    .multiselect-trigger.is-open {
      border-color: #004489;
    }

    .trigger-text {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .trigger-arrow {
      color: #64748b;
      font-size: 20px;
      height: 20px;
      width: 20px;
      margin-left: 4px;
    }

    .multiselect-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      min-width: 200px;
      background: #ffffff;
      border: 1.5px solid #d5dded;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12);
      z-index: 100;
      padding: 8px;
      text-transform: none;
      letter-spacing: normal;
    }

    .multiselect-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 6px 6px;
      border-bottom: 1px solid #f1f5f9;
      margin-bottom: 4px;
    }

    .btn-text-action {
      background: transparent;
      border: none;
      color: #004489;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .btn-text-action:hover {
      background: rgba(0, 68, 137, 0.08);
    }

    .action-divider {
      color: #cbd5e1;
      font-weight: bold;
    }

    .multiselect-options {
      display: grid;
      gap: 2px;
      max-height: 200px;
      overflow-y: auto;
    }

    .multiselect-option {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.84rem;
      font-weight: 500;
      color: #1e293b;
      text-transform: none !important;
      letter-spacing: normal !important;
    }

    .multiselect-option:hover {
      background: #f8fafc;
    }

    .multiselect-option input[type="checkbox"] {
      width: 15px;
      height: 15px;
      accent-color: #004489;
      cursor: pointer;
      margin: 0;
    }

    .clear-filter {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 42px;
      padding: 0 14px;
      border-radius: 10px;
      border: 1px solid var(--surface-border);
      background: #ffffff;
      font-size: 0.85rem;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s;
      align-self: flex-end;
    }

    .clear-filter:hover:not(:disabled) {
      color: var(--brand-accent);
      border-color: var(--brand-accent);
      background: rgba(106, 0, 255, 0.04);
    }

    .clear-filter:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .report-status {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .report-status i {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      margin-right: 6px;
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .metric-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      border-radius: 16px;
      background: #ffffff;
      border: 1px solid var(--surface-border);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
    }

    .metric-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: rgba(106, 0, 255, 0.08);
      color: var(--brand-accent);
    }

    .metric-card span {
      display: block;
      font-size: 0.82rem;
      color: var(--text-muted);
      margin-bottom: 2px;
    }

    .metric-card strong {
      display: block;
      font-size: 1.45rem;
      font-weight: 800;
    }

    .metric-card p {
      margin: 2px 0 0;
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
    }

    .dashboard-card {
      padding: 24px;
      border-radius: 18px;
      background: #ffffff;
      border: 1px solid var(--surface-border);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
    }

    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .card-head h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
    }

    .card-head .badge {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
      background: #f1f5f9;
      color: var(--text-muted);
    }

    .bar-chart.daily {
      display: grid;
      grid-template-columns: repeat(7, minmax(42px, 1fr));
      gap: 12px;
      min-height: 260px;
      align-items: end;
    }

    .bar-item {
      display: grid;
      gap: 8px;
      justify-items: center;
      text-align: center;
    }

    .bar-track {
      position: relative;
      width: 100%;
      max-width: 64px;
      height: 180px;
      border-radius: 12px;
      background: #eef2f7;
      overflow: hidden;
    }

    .bar-track span {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      min-height: 4px;
      border-radius: 12px 12px 0 0;
      background: var(--brand-gradient);
    }

    .bar-item small {
      color: var(--text-muted);
    }

    .payment-list,
    .event-sales-list,
    .recent-list {
      display: grid;
      gap: 14px;
    }

    .payment-row {
      display: grid;
      grid-template-columns: 130px minmax(0, 1fr) 44px;
      gap: 12px;
      align-items: center;
      width: 100%;
      border: 0;
      background: transparent;
      text-align: left;
      font: inherit;
      color: inherit;
      cursor: pointer;
      padding: 6px 8px;
      border-radius: 10px;
      transition: background 0.15s;
    }

    .payment-row:hover,
    .payment-row.is-selected {
      background: rgba(106, 0, 255, 0.06);
    }

    .payment-label span {
      display: block;
      margin-top: 3px;
      color: var(--text-muted);
      font-size: 0.82rem;
    }

    .progress-track,
    .event-progress {
      height: 10px;
      border-radius: 999px;
      background: #eef2f7;
      overflow: hidden;
    }

    .progress-track span,
    .event-progress span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--brand-accent);
    }

    .events-card,
    .recent-card {
      grid-column: 1 / -1;
    }

    .event-sales-row,
    .recent-row {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) minmax(160px, 320px) 120px;
      gap: 14px;
      align-items: center;
      padding: 14px 0;
      border-bottom: 1px solid var(--surface-border);
    }

    .recent-row {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .recent-row p {
      margin: 4px 0 0;
    }

    @media (max-width: 1120px) {
      .filter-panel { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .dashboard-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 720px) {
      .filter-panel { grid-template-columns: 1fr; }
      .report-status { align-items: flex-start; flex-direction: column; gap: 5px; }
      .sales-hero,
      .card-head { align-items: flex-start; flex-direction: column; }
      .metric-grid { grid-template-columns: 1fr; }
      .bar-chart.daily { grid-template-columns: repeat(4, minmax(42px, 1fr)); }
      .payment-row,
      .event-sales-row { grid-template-columns: 1fr; }
    }
  `]
})
export class OverviewComponent {
  private readonly auth = inject(AuthService);
  private readonly booking = inject(BookingService);
  private readonly events = inject(EventService);
  private readonly dashboardMetrics = inject(DashboardMetricsService);

  readonly paymentOptions = [
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'visalink', label: 'VisaLink' },
    { value: 'compraclic', label: 'CompraClick' },
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'tarjeta', label: 'Tarjeta' },
    { value: 'cortesia', label: 'Cortesía' },
  ];

  isPaymentMenuOpen = false;

  private readonly filtersSubject = new BehaviorSubject<DashboardFilters>({
    eventId: 'all',
    category: 'all',
    period: 'all',
    paymentMethods: []
  });

  readonly user$ = this.auth.user$;
  filters = this.filtersSubject.value;

  readonly vm$ = combineLatest([
    this.booking.getReservations(),
    this.events.getEvents(),
    this.filtersSubject
  ]).pipe(
    switchMap(([bookings, events, filters]) => {
      const visibleEvents = this.filterEvents(events, filters);
      const dateFrom = this.periodStart(filters.period);
      const methodsToSend = filters.paymentMethods.length > 0 && filters.paymentMethods.length < this.paymentOptions.length
        ? filters.paymentMethods
        : undefined;

      return visibleEvents.length
        ? this.dashboardMetrics.get(visibleEvents.map((event) => event.id), dateFrom, methodsToSend).pipe(
            map((response) => this.buildDashboard(bookings, events, filters, response.data))
          )
        : of(this.buildDashboard(bookings, events, filters, null));
    })
  );

  togglePaymentMenu(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.isPaymentMenuOpen = !this.isPaymentMenuOpen;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isPaymentMenuOpen = false;
  }

  isPaymentSelected(method: string): boolean {
    return this.filters.paymentMethods.includes(method);
  }

  togglePaymentMethod(method: string): void {
    let next: string[];
    if (this.filters.paymentMethods.includes(method)) {
      next = this.filters.paymentMethods.filter((m) => m !== method);
    } else {
      next = [...this.filters.paymentMethods, method];
    }
    this.filters = { ...this.filters, paymentMethods: next };
    this.filtersSubject.next(this.filters);
  }

  selectAllPaymentMethods(): void {
    this.filters = {
      ...this.filters,
      paymentMethods: this.paymentOptions.map((o) => o.value)
    };
    this.filtersSubject.next(this.filters);
  }

  clearPaymentMethods(): void {
    this.filters = {
      ...this.filters,
      paymentMethods: []
    };
    this.filtersSubject.next(this.filters);
  }

  get paymentMethodsDisplayText(): string {
    const selected = this.filters.paymentMethods;
    if (!selected || selected.length === 0 || selected.length === this.paymentOptions.length) {
      return 'Todos';
    }
    if (selected.length === 1) {
      const found = this.paymentOptions.find((o) => o.value === selected[0]);
      return found ? found.label : selected[0];
    }
    if (selected.length === 2) {
      return selected
        .map((val) => this.paymentOptions.find((o) => o.value === val)?.label ?? val)
        .join(', ');
    }
    return `${selected.length} seleccionados`;
  }

  setFilter(field: 'eventId' | 'category' | 'period', event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filters = { ...this.filters, [field]: value } as DashboardFilters;
    this.filtersSubject.next(this.filters);
  }

  clearFilters(): void {
    this.filters = { eventId: 'all', category: 'all', period: 'all', paymentMethods: [] };
    this.filtersSubject.next(this.filters);
  }

  categories(events: EventItem[]): string[] {
    return [...new Set(events.map((event) => event.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  filterByPayment(method?: string): void {
    if (!method || method === 'sin_especificar') return;
    this.togglePaymentMethod(method);
  }

  private buildDashboard(
    bookings: BookingRecord[],
    events: EventItem[],
    filters: DashboardFilters,
    serverMetrics: DashboardMetrics | null
  ): SalesDashboardVm {
    const allEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const currentEvents = allEvents.filter((event) => this.isCurrentEvent(event));
    const hasFilters =
      filters.eventId !== 'all' ||
      filters.category !== 'all' ||
      filters.period !== 'all' ||
      (filters.paymentMethods.length > 0 && filters.paymentMethods.length < this.paymentOptions.length);

    const visibleEvents = (hasFilters ? allEvents : currentEvents).filter((event) =>
      (filters.eventId === 'all' || event.id === filters.eventId) &&
      (filters.category === 'all' || event.category === filters.category)
    );
    const visibleEventIds = new Set(visibleEvents.map((event) => String(event.id)));
    const visibleBookings = bookings.filter((booking) =>
      visibleEventIds.has(String(booking.eventId)) &&
      this.bookingMatchesPeriod(booking, filters.period) &&
      (filters.paymentMethods.length === 0 ||
        filters.paymentMethods.length === this.paymentOptions.length ||
        filters.paymentMethods.includes(this.paymentMethodKey(booking.paymentMethod)))
    );

    bookings = visibleBookings;
    events = visibleEvents;
    const paidBookings = bookings.filter((booking) =>
      booking.status === 'confirmed' || booking.status === 'used'
    );
    const occupiedBookings = bookings.filter((booking) =>
      booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'used'
    );
    const calculatedRevenue = paidBookings.reduce((sum, booking) => sum + booking.totals.total, 0);
    const calculatedSoldTickets = paidBookings.reduce((sum, booking) => sum + booking.seats.length, 0);
    const calculatedAvailableTickets = events.reduce((sum, event) => {
      const occupied = occupiedBookings
        .filter((booking) => booking.eventId === event.id)
        .reduce((seatSum, booking) => seatSum + booking.seats.length, 0);
      return sum + Math.max(event.metrics.ticketsLeft - occupied, 0);
    }, 0);
    const calculatedCashRevenue = paidBookings
      .filter((booking) => this.isCashPayment(booking.paymentMethod))
      .reduce((sum, booking) => sum + booking.totals.total, 0);

    const totalRevenue = serverMetrics?.total_revenue ?? calculatedRevenue;
    const soldTickets = serverMetrics?.sold_tickets ?? calculatedSoldTickets;
    const availableTickets = serverMetrics?.available_tickets ?? calculatedAvailableTickets;
    const cashRevenue = serverMetrics?.cash_revenue ?? calculatedCashRevenue;
    const approvedSales = serverMetrics?.approved_sales ?? paidBookings.length;
    const cardRevenue = Number(serverMetrics?.payment_methods?.find((row) => row.method === 'tarjeta')?.revenue
      ?? serverMetrics?.card_revenue ?? 0);

    const eventRows = events
      .map((event) => {
        const eventBookings = paidBookings.filter((booking) => booking.eventId === event.id);
        const eventOccupiedBookings = occupiedBookings.filter((booking) => booking.eventId === event.id);
        const sold = eventBookings.reduce((sum, booking) => sum + booking.seats.length, 0);
        const occupied = eventOccupiedBookings.reduce((sum, booking) => sum + booking.seats.length, 0);
        const revenue = eventBookings.reduce((sum, booking) => sum + booking.totals.total, 0);
        const capacity = event.metrics.ticketsLeft;
        const available = Math.max(capacity - occupied, 0);

        return {
          event,
          sold,
          available,
          revenue,
          progress: capacity > 0 ? Math.round((occupied / capacity) * 100) : 0
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    return {
      metrics: [
        {
          label: 'Resumen de ventas',
          value: this.formatCurrency(totalRevenue),
          detail: `${approvedSales} ventas aprobadas`,
          icon: 'query_stats'
        },
        {
          label: 'Entradas vendidas',
          value: soldTickets.toLocaleString('es-GT'),
          detail: 'Tickets emitidos y confirmados',
          icon: 'confirmation_number'
        },
        {
          label: 'Entradas disponibles',
          value: availableTickets.toLocaleString('es-GT'),
          detail: `${events.length} eventos administrados`,
          icon: 'event_available'
        },
        {
          label: 'Ingresos totales',
          value: this.formatCurrency(totalRevenue),
          detail: `${this.formatCurrency(cashRevenue)} en efectivo`,
          icon: 'payments'
        }
      ],
      dailySales: this.buildDailySales(paidBookings),
      paymentMethods: this.buildPaymentMethods(paidBookings, serverMetrics),
      eventRows,
      recentBookings: [...paidBookings]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 6),
      totalRevenue,
      cashRevenue,
      cardRevenue,
      visibleEvents,
      allEvents,
      currentEventsCount: currentEvents.length,
      hasFilters
    };
  }

  private isCurrentEvent(event: EventItem): boolean {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const eventDate = new Date(event.date);
    return event.status !== 'draft' && event.status !== 'sold-out' &&
      !Number.isNaN(eventDate.getTime()) && eventDate.getTime() >= startOfToday.getTime();
  }

  private filterEvents(events: EventItem[], filters: DashboardFilters): EventItem[] {
    const allEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const hasEventFilters = filters.eventId !== 'all' || filters.category !== 'all';
    return (hasEventFilters ? allEvents : allEvents.filter((event) => this.isCurrentEvent(event))).filter((event) =>
      (filters.eventId === 'all' || event.id === filters.eventId) &&
      (filters.category === 'all' || event.category === filters.category)
    );
  }

  private periodStart(period: DashboardFilters['period']): string | undefined {
    if (period === 'all') return undefined;
    const date = new Date();
    date.setDate(date.getDate() - (period === 'today' ? 0 : period === 'week' ? 6 : 29));
    return date.toISOString().slice(0, 10);
  }

  private bookingMatchesPeriod(booking: BookingRecord, period: DashboardFilters['period']): boolean {
    if (period === 'all') return true;
    const createdAt = new Date(booking.createdAt).getTime();
    const now = Date.now();
    const days = period === 'today' ? 1 : period === 'week' ? 7 : 30;
    return createdAt >= now - days * 24 * 60 * 60 * 1000;
  }

  private buildDailySales(bookings: BookingRecord[]): ChartPoint[] {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      return date;
    });

    const points = days.map((date) => {
      const key = date.toISOString().slice(0, 10);
      const value = bookings
        .filter((booking) => booking.createdAt.slice(0, 10) === key)
        .reduce((sum, booking) => sum + booking.seats.length, 0);

      return {
        label: new Intl.DateTimeFormat('es-GT', { weekday: 'short' }).format(date),
        value,
        display: value.toLocaleString('es-GT'),
        percent: 0
      };
    });

    return this.withPercent(points);
  }

  private buildPaymentMethods(_bookings: BookingRecord[], serverMetrics: DashboardMetrics | null): ChartPoint[] {
    const labels: Record<string, string> = {
      efectivo: 'Efectivo',
      visalink: 'VisaLink',
      compraclic: 'CompraClick',
      transferencia: 'Transferencia',
      tarjeta: 'Tarjeta',
      cortesia: 'Cortesía',
      sin_especificar: 'Sin especificar'
    };
    const paymentRows = serverMetrics?.payment_methods;
    const databaseValues = new Map((paymentRows ?? []).map((row) => [row.method, Number(row.revenue) || 0]));
    if (!paymentRows) {
      databaseValues.set('efectivo', Number(serverMetrics?.cash_revenue) || 0);
      const legacyFields: Array<[string, number | undefined]> = [
        ['visalink', serverMetrics?.visalink_revenue],
        ['compraclic', serverMetrics?.compraclic_revenue],
        ['transferencia', serverMetrics?.transfer_revenue],
        ['tarjeta', serverMetrics?.card_revenue],
        ['cortesia', serverMetrics?.cortesia_revenue]
      ];
      legacyFields.forEach(([method, value]) => {
        if (value !== undefined) databaseValues.set(method, Number(value) || 0);
      });
      const classifiedRevenue = [...databaseValues.values()].reduce((sum, value) => sum + value, 0);
      const unclassifiedRevenue = Math.max((Number(serverMetrics?.total_revenue) || 0) - classifiedRevenue, 0);
      if (unclassifiedRevenue > 0) databaseValues.set('sin_especificar', unclassifiedRevenue);
    }
    const knownMethods = ['efectivo', 'visalink', 'compraclic', 'transferencia', 'tarjeta', 'cortesia'];
    const methods = [...knownMethods, ...[...databaseValues.keys()].filter((method) => !knownMethods.includes(method))];
    const points = methods.map((method) => ({
      key: method,
      label: labels[method] ?? method,
      value: databaseValues.get(method) ?? 0,
      display: this.formatCurrency(databaseValues.get(method) ?? 0),
      percent: 0
    }));

    return this.withPercent(points);
  }

  private withPercent(points: ChartPoint[]): ChartPoint[] {
    const max = Math.max(...points.map((point) => point.value), 1);

    return points.map((point) => ({
      ...point,
      percent: point.value > 0 ? Math.max(8, Math.round((point.value / max) * 100)) : 0
    }));
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: 'GTQ',
      maximumFractionDigits: 0
    }).format(value);
  }

  private isCashPayment(paymentMethod: string): boolean {
    return paymentMethod.trim().toLocaleLowerCase('es-GT').includes('efectivo');
  }

  private paymentMethodLabel(paymentMethod: string): string {
    const method = paymentMethod.trim().toLocaleLowerCase('es-GT');
    if (method.includes('efectivo')) return 'Efectivo';
    if (method.includes('visalink')) return 'VisaLink';
    if (method.includes('compraclic')) return 'CompraClick';
    if (method.includes('transferencia')) return 'Transferencia';
    if (method.includes('cortesia') || method.includes('cortesía')) return 'Cortesía';
    return 'Tarjeta';
  }

  private paymentMethodKey(paymentMethod: string): string {
    const method = paymentMethod.trim().toLocaleLowerCase('es-GT');
    if (method.includes('efectivo')) return 'efectivo';
    if (method.includes('visalink')) return 'visalink';
    if (method.includes('compraclic')) return 'compraclic';
    if (method.includes('transferencia')) return 'transferencia';
    if (method.includes('cortesia') || method.includes('cortesía')) return 'cortesia';
    if (method.includes('tarjeta') || method.includes('card')) return 'tarjeta';
    return 'sin_especificar';
  }
}
