import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
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
  paymentMethod: 'all' | 'efectivo' | 'visalink' | 'compraclic' | 'transferencia' | 'tarjeta' | 'cortesia';
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

          <label>
            <span>Método de pago</span>
            <select [value]="filters.paymentMethod" (change)="setFilter('paymentMethod', $event)">
              <option value="all">Todos</option>
              <option value="efectivo">Efectivo</option>
              <option value="visalink">VisaLink</option>
              <option value="compraclic">CompraClick</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="cortesia">Cortesía</option>
            </select>
          </label>

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
          <article class="panel-surface chart-card">
            <div class="card-head">
              <div>
                <p class="eyebrow">Grafica</p>
                <h2>Ventas por dia</h2>
              </div>
              <span>{{ vm.dailySales.length }} dias</span>
            </div>

            <div class="bar-chart daily">
              @for (point of vm.dailySales; track point.label) {
                <div class="bar-item">
                  <div class="bar-track">
                    <span [style.height.%]="point.percent"></span>
                  </div>
                  <strong>{{ point.display }}</strong>
                  <small>{{ point.label }}</small>
                </div>
              }
            </div>
          </article>

          <article class="panel-surface chart-card">
            <div class="card-head">
              <div>
                <p class="eyebrow">Grafica</p>
                <h2>Ingresos por pago</h2>
              </div>
              <span>{{ vm.totalRevenue | currencyGtq }}</span>
            </div>

            <div class="payment-list">
              @for (point of vm.paymentMethods; track point.label) {
                <button type="button" class="payment-row" [class.is-selected]="filters.paymentMethod === point.key"
                  (click)="filterByPayment(point.key)">
                  <div class="payment-label">
                    <strong>{{ point.label }}</strong>
                    <span>{{ point.display }}</span>
                  </div>
                  <div class="progress-track">
                    <span [style.width.%]="point.percent"></span>
                  </div>
                  <small>{{ point.percent | number: '1.0-0' }}%</small>
                </button>
              }
            </div>
          </article>

          <article class="panel-surface split-card">
            <div class="card-head">
              <div>
                <p class="eyebrow">Composicion</p>
                <h2>Canales de ingreso</h2>
              </div>
            </div>
            <div class="split-values">
              @for (point of vm.paymentMethods; track point.label) {
                <div>
                  <span>{{ point.label }}</span>
                  <strong>{{ point.value | currencyGtq }}</strong>
                </div>
              }
            </div>
          </article>

          <article class="panel-surface events-card">
            <div class="card-head">
              <div>
                <p class="eyebrow">Eventos</p>
                <h2>Ventas por evento</h2>
              </div>
              <a mat-stroked-button routerLink="/dashboard/eventos">Administrar</a>
            </div>

            <div class="event-sales-list">
              @for (row of vm.eventRows; track row.event.id) {
                <div class="event-sales-row">
                  <div class="event-title">
                    <strong>{{ row.event.name }}</strong>
                    <span>{{ row.sold }} vendidas · {{ row.available }} disponibles</span>
                  </div>
                  <div class="event-progress">
                    <span [style.width.%]="row.progress"></span>
                  </div>
                  <strong>{{ row.revenue | currencyGtq }}</strong>
                </div>
              }
            </div>
          </article>

          <article class="panel-surface recent-card">
            <div class="card-head">
              <div>
                <p class="eyebrow">Actividad</p>
                <h2>Ultimas ventas</h2>
              </div>
              <a mat-stroked-button routerLink="/dashboard/tickets">Ver tickets</a>
            </div>

            <div class="recent-list">
              @for (booking of vm.recentBookings; track booking.id) {
                <div class="recent-row">
                  <div>
                    <strong>{{ booking.eventName }}</strong>
                    <p>{{ booking.createdAt | date: 'd MMM, h:mm a' }} · {{ booking.paymentMethod }}</p>
                  </div>
                  <span>{{ booking.totals.total | currencyGtq }}</span>
                </div>
              }
            </div>
          </article>
        </div>
      </ng-container>
    </section>
  `,
  styles: [`
    .sales-dashboard {
      display: grid;
      gap: 22px;
      width: min(100%, var(--page-max));
      margin: 0 auto;
    }

    .filter-panel {
      display: grid;
      grid-template-columns: minmax(190px, 1.15fr) repeat(4, minmax(140px, 1fr)) auto;
      gap: 12px;
      align-items: end;
      padding: 16px 18px;
      border: 1px solid var(--surface-border);
      border-radius: 16px;
      background: #fff;
      box-shadow: var(--shadow-soft);
    }

    .filter-title {
      display: flex;
      align-items: center;
      gap: 11px;
      align-self: center;
    }

    .filter-title small,
    .filter-panel label span {
      display: block;
      color: var(--text-muted);
      font-size: 0.72rem;
    }

    .filter-title small { margin-top: 3px; }

    .filter-icon {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      color: #fff;
      background: var(--brand-gradient);
    }

    .filter-panel label span {
      margin: 0 0 6px 2px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .filter-panel select {
      width: 100%;
      height: 42px;
      padding: 0 34px 0 12px;
      border: 1px solid #d9dce3;
      border-radius: 9px;
      background: #fff;
      color: var(--text-primary);
      font: 500 0.84rem Montserrat, sans-serif;
      cursor: pointer;
    }

    .filter-panel select:focus {
      border-color: var(--brand-primary);
      outline: 3px solid rgba(106, 0, 255, 0.1);
    }

    .clear-filter {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      height: 42px;
      padding: 0 14px;
      border: 1px solid #d9dce3;
      border-radius: 9px;
      background: #fff;
      color: var(--brand-primary);
      font-weight: 700;
      cursor: pointer;
    }

    .clear-filter:disabled { opacity: 0.42; cursor: default; }

    .report-status {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: -12px;
      padding: 0 4px;
      color: var(--text-muted);
      font-size: 0.76rem;
    }

    .report-status i {
      display: inline-block;
      width: 7px;
      height: 7px;
      margin-right: 5px;
      border-radius: 50%;
      background: #28a76f;
      box-shadow: 0 0 0 3px rgba(40, 167, 111, 0.13);
    }

    .sales-hero {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      padding: 28px;
      border-radius: 18px;
      background:
        linear-gradient(135deg, rgba(106, 0, 255, 0.95), rgba(13, 13, 13, 0.98)),
        url('https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80');
      background-size: cover;
      background-position: center;
      color: #fff;
      overflow: hidden;
    }

    .sales-hero h1 {
      font-size: clamp(2rem, 4vw, 3.25rem);
      line-height: 1;
    }

    .sales-hero p {
      max-width: 620px;
      margin: 8px 0 0;
      color: rgba(255, 255, 255, 0.78);
    }

    .hero-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }

    .metric-card {
      position: relative;
      display: flex;
      gap: 14px;
      min-height: 118px;
      padding: 20px;
      border: 1px solid var(--surface-border);
      border-radius: 16px;
      background: #fff;
      box-shadow: var(--shadow-soft);
      overflow: hidden;
    }

    .metric-card::before {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 4px;
      background: var(--brand-gradient);
    }

    .metric-icon {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(0, 68, 137, 0.1);
      color: var(--brand-primary);
      flex: 0 0 auto;
    }

    .metric-card span,
    .card-head span,
    .recent-row p,
    .event-title span {
      color: var(--text-muted);
      font-size: 0.85rem;
    }

    .metric-card strong {
      display: block;
      margin-top: 6px;
      font-size: 1.75rem;
      font-family: 'Eurostile Extended', 'Montserrat', sans-serif;
    }

    .metric-card p {
      margin: 4px 0 0;
      color: var(--text-muted);
      font-size: 0.82rem;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
      gap: 18px;
      align-items: start;
    }

    .chart-card,
    .split-card,
    .events-card,
    .recent-card {
      display: grid;
      gap: 18px;
    }

    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
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
    }
    button.payment-row { width:100%;border:0;background:transparent;text-align:left;font:inherit;color:inherit;cursor:pointer; }
    button.payment-row:hover,button.payment-row.is-selected { background:rgba(106,0,255,.05);border-radius:10px; }

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

    .split-values {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .split-values div {
      padding: 18px;
      border-radius: 14px;
      background: #f8fafc;
      border: 1px solid var(--surface-border);
    }

    .split-values span {
      display: block;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .split-values strong {
      font-size: 1.35rem;
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

      .metric-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .dashboard-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .filter-panel { grid-template-columns: 1fr; }

      .report-status { align-items: flex-start; flex-direction: column; gap: 5px; }
      .sales-hero,
      .card-head {
        align-items: flex-start;
        flex-direction: column;
      }

      .metric-grid,
      .split-values {
        grid-template-columns: 1fr;
      }

      .bar-chart.daily {
        grid-template-columns: repeat(4, minmax(42px, 1fr));
      }

      .payment-row,
      .event-sales-row {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class OverviewComponent {
  private readonly auth = inject(AuthService);
  private readonly booking = inject(BookingService);
  private readonly events = inject(EventService);
  private readonly dashboardMetrics = inject(DashboardMetricsService);
  private readonly filtersSubject = new BehaviorSubject<DashboardFilters>({
    eventId: 'all',
    category: 'all',
    period: 'all',
    paymentMethod: 'all'
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
      return visibleEvents.length
        ? this.dashboardMetrics.get(visibleEvents.map((event) => event.id), dateFrom,
            filters.paymentMethod === 'all' ? undefined : filters.paymentMethod).pipe(
            map((response) => this.buildDashboard(bookings, events, filters, response.data))
          )
        : of(this.buildDashboard(bookings, events, filters, null));
    })
  );

  setFilter(field: keyof DashboardFilters, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filters = { ...this.filters, [field]: value } as DashboardFilters;
    this.filtersSubject.next(this.filters);
  }

  clearFilters(): void {
    this.filters = { eventId: 'all', category: 'all', period: 'all', paymentMethod: 'all' };
    this.filtersSubject.next(this.filters);
  }

  categories(events: EventItem[]): string[] {
    return [...new Set(events.map((event) => event.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  filterByPayment(method?: string): void {
    if (!method || method === 'sin_especificar') return;
    this.filters = { ...this.filters, paymentMethod: this.filters.paymentMethod === method ? 'all' : method as DashboardFilters['paymentMethod'] };
    this.filtersSubject.next(this.filters);
  }

  private buildDashboard(
    bookings: BookingRecord[],
    events: EventItem[],
    filters: DashboardFilters,
    serverMetrics: DashboardMetrics | null
  ): SalesDashboardVm {
    const allEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const currentEvents = allEvents.filter((event) => this.isCurrentEvent(event));
    const hasFilters = filters.eventId !== 'all' || filters.category !== 'all' || filters.period !== 'all' || filters.paymentMethod !== 'all';
    const visibleEvents = (hasFilters ? allEvents : currentEvents).filter((event) =>
      (filters.eventId === 'all' || event.id === filters.eventId) &&
      (filters.category === 'all' || event.category === filters.category)
    );
    const visibleEventIds = new Set(visibleEvents.map((event) => String(event.id)));
    const visibleBookings = bookings.filter((booking) =>
      visibleEventIds.has(String(booking.eventId)) && this.bookingMatchesPeriod(booking, filters.period) &&
      (filters.paymentMethod === 'all' || this.paymentMethodKey(booking.paymentMethod) === filters.paymentMethod)
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
        ['tarjeta', serverMetrics?.card_revenue]
      ];
      legacyFields.forEach(([method, value]) => {
        if (value !== undefined) databaseValues.set(method, Number(value) || 0);
      });
      const classifiedRevenue = [...databaseValues.values()].reduce((sum, value) => sum + value, 0);
      const unclassifiedRevenue = Math.max((Number(serverMetrics?.total_revenue) || 0) - classifiedRevenue, 0);
      if (unclassifiedRevenue > 0) databaseValues.set('sin_especificar', unclassifiedRevenue);
    }
    const knownMethods = ['efectivo', 'visalink', 'compraclic', 'transferencia', 'tarjeta'];
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
    return 'Tarjeta';
  }

  private paymentMethodKey(paymentMethod: string): DashboardFilters['paymentMethod'] | 'sin_especificar' {
    const method = paymentMethod.trim().toLocaleLowerCase('es-GT');
    if (method.includes('efectivo')) return 'efectivo';
    if (method.includes('visalink')) return 'visalink';
    if (method.includes('compraclic')) return 'compraclic';
    if (method.includes('transferencia')) return 'transferencia';
    if (method.includes('cortesia') || method.includes('cortesía')) return 'cortesia';
    if (method) return 'tarjeta';
    return 'sin_especificar';
  }
}
