import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { BookingRecord } from '../../core/models/booking.model';
import { EventItem } from '../../core/models/event.model';
import { AuthService } from '../../core/services/auth.service';
import { BookingService } from '../../core/services/booking.service';
import { EventService } from '../../core/services/event.service';
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
                <div class="payment-row">
                  <div class="payment-label">
                    <strong>{{ point.label }}</strong>
                    <span>{{ point.display }}</span>
                  </div>
                  <div class="progress-track">
                    <span [style.width.%]="point.percent"></span>
                  </div>
                  <small>{{ point.percent | number: '1.0-0' }}%</small>
                </div>
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
              <div>
                <span>Tarjeta</span>
                <strong>{{ vm.cardRevenue | currencyGtq }}</strong>
              </div>
              <div>
                <span>Efectivo</span>
                <strong>{{ vm.cashRevenue | currencyGtq }}</strong>
              </div>
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

    .sales-hero {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      padding: 28px;
      border-radius: 18px;
      background:
        linear-gradient(135deg, rgba(0, 68, 137, 0.95), rgba(18, 31, 52, 0.98)),
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
      display: flex;
      gap: 14px;
      min-height: 118px;
      padding: 20px;
      border: 1px solid var(--surface-border);
      border-radius: 16px;
      background: #fff;
      box-shadow: var(--shadow-soft);
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
      font-family: 'Bahnschrift', 'Segoe UI', sans-serif;
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
      background: linear-gradient(180deg, #0d63b7, #004489);
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
      .metric-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .dashboard-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
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

  readonly user$ = this.auth.user$;
  readonly vm$ = combineLatest([this.booking.getReservations(), this.events.events$]).pipe(
    map(([bookings, events]) => this.buildDashboard(bookings, events))
  );

  private buildDashboard(bookings: BookingRecord[], events: EventItem[]): SalesDashboardVm {
    const totalRevenue = bookings.reduce((sum, booking) => sum + booking.totals.total, 0);
    const soldTickets = bookings.reduce((sum, booking) => sum + booking.seats.length, 0);
    const availableTickets = events.reduce((sum, event) => sum + event.metrics.ticketsLeft, 0);
    const cashRevenue = bookings
      .filter((booking) => booking.paymentMethod.startsWith('Efectivo'))
      .reduce((sum, booking) => sum + booking.totals.total, 0);
    const cardRevenue = totalRevenue - cashRevenue;

    const eventRows = events
      .map((event) => {
        const eventBookings = bookings.filter((booking) => booking.eventId === event.id);
        const sold = eventBookings.reduce((sum, booking) => sum + booking.seats.length, 0);
        const revenue = eventBookings.reduce((sum, booking) => sum + booking.totals.total, 0);
        const available = event.metrics.ticketsLeft;
        const capacity = sold + available;

        return {
          event,
          sold,
          available,
          revenue,
          progress: capacity > 0 ? Math.round((sold / capacity) * 100) : 0
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    return {
      metrics: [
        {
          label: 'Resumen de ventas',
          value: this.formatCurrency(totalRevenue),
          detail: `${bookings.length} ordenes registradas`,
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
      dailySales: this.buildDailySales(bookings),
      paymentMethods: this.buildPaymentMethods(bookings),
      eventRows,
      recentBookings: [...bookings]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 6),
      totalRevenue,
      cashRevenue,
      cardRevenue
    };
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

  private buildPaymentMethods(bookings: BookingRecord[]): ChartPoint[] {
    const grouped = bookings.reduce<Record<string, number>>((acc, booking) => {
      const label = booking.paymentMethod.startsWith('Efectivo') ? 'Efectivo' : 'Tarjeta';
      acc[label] = (acc[label] ?? 0) + booking.totals.total;
      return acc;
    }, {});

    const points = Object.entries(grouped).map(([label, value]) => ({
      label,
      value,
      display: this.formatCurrency(value),
      percent: 0
    }));

    return this.withPercent(points.length ? points : [{ label: 'Sin ventas', value: 0, display: 'Q0.00', percent: 0 }]);
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
}
