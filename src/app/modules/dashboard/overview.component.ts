import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { EventItem } from '../../core/models/event.model';
import { AuthService } from '../../core/services/auth.service';
import { BookingService } from '../../core/services/booking.service';
import { EventService } from '../../core/services/event.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, RouterLink, ...MATERIAL_IMPORTS],
  template: `
    <div class="overview-root">

      <!-- ── Hero Banner ── -->
      <div class="hero-banner">
        <div class="hero-deco"></div>

        <div class="hero-left">
          <span class="hero-badge">Admin Portal</span>
          <h1 class="hero-name">{{ (user$ | async)?.fullName }}</h1>
          <p class="hero-sub">Panel operacional &mdash; ALCON Productions</p>
          <div class="hero-ctas">
            <a mat-flat-button routerLink="/dashboard/seat-map-builder" class="cta-primary">
              <mat-icon>table_restaurant</mat-icon>
              Crear mapa de asientos
            </a>
            <a mat-stroked-button routerLink="/events" class="cta-ghost">Ver eventos</a>
          </div>
        </div>

        <div class="hero-metrics">
          @for (stat of (stats$ | async) ?? []; track stat.label) {
            <div class="hm-card">
              <strong class="hm-value">{{ stat.value }}</strong>
              <span class="hm-label">{{ stat.label }}</span>
            </div>
          }
        </div>
      </div>

      <!-- ── Events under tracking ── -->
      <section class="events-section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Operación</p>
            <h2>Eventos bajo seguimiento</h2>
          </div>
          <a mat-stroked-button routerLink="/events">Ver todos</a>
        </div>

        <div class="events-grid">
          @for (event of (featuredEvents$ | async) ?? []; track event.id) {
            <article class="event-tile panel-surface">
              <div class="tile-header">
                <span class="category-label">{{ event.category }}</span>
                <span class="status-tag" [class]="event.status">{{ statusLabel(event) }}</span>
              </div>
              <h3>{{ event.name }}</h3>
              <p class="tile-meta">
                {{ event.date | date: 'EEE d MMM' }} &bull; {{ event.venueName }} &bull; {{ event.city }}
              </p>
              <p class="tile-desc">{{ event.shortDescription }}</p>
              <div class="tile-kpis">
                <div class="kpi">
                  <strong>{{ event.metrics.interested | number }}</strong>
                  <span>Interesados</span>
                </div>
                <div class="kpi">
                  <strong>{{ event.metrics.ticketsLeft }}</strong>
                  <span>Disponibles</span>
                </div>
                <div class="kpi">
                  <strong>{{ event.metrics.rating }}</strong>
                  <span>Rating</span>
                </div>
              </div>
            </article>
          }
        </div>
      </section>

      <!-- ── Admin tools ── -->
      <section class="tools-section">
        <p class="eyebrow" style="margin-bottom: 14px;">Herramientas administrativas</p>
        <div class="tools-grid">
          <a class="tool-card panel-surface" routerLink="/dashboard/seat-map-builder">
            <div class="tool-icon">
              <mat-icon>table_restaurant</mat-icon>
            </div>
            <div class="tool-text">
              <strong>Crear Mapa de Asientos</strong>
              <p>Configura secciones y mesas para cualquier evento.</p>
            </div>
            <mat-icon class="tool-arrow">arrow_forward</mat-icon>
          </a>
          <a class="tool-card panel-surface" routerLink="/dashboard/tickets">
            <div class="tool-icon">
              <mat-icon>confirmation_number</mat-icon>
            </div>
            <div class="tool-text">
              <strong>Tickets Emitidos</strong>
              <p>Revisa y gestiona todos los tickets del sistema.</p>
            </div>
            <mat-icon class="tool-arrow">arrow_forward</mat-icon>
          </a>
        </div>
      </section>

    </div>
  `,
  styles: [`
    .overview-root {
      display: grid;
      gap: 28px;
    }

    /* ────────────────────────────────
       Hero Banner
    ──────────────────────────────── */
    .hero-banner {
      position: relative;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 32px;
      padding: 40px 48px;
      border-radius: 20px;
      background: linear-gradient(135deg, #07111f 0%, #0f2240 45%, #0d1e38 100%);
      color: #fff;
      overflow: hidden;
    }

    /* Decorative glow blob */
    .hero-deco {
      position: absolute;
      top: -80px;
      right: -80px;
      width: 360px;
      height: 360px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(0, 102, 204, 0.22) 0%, transparent 65%);
      pointer-events: none;
    }

    /* Left: greeting */
    .hero-left {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 14px;
      max-width: 440px;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      font-size: 0.68rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.7);
      width: fit-content;
    }

    .hero-name {
      font-size: 2.4rem;
      color: #fff;
      margin: 0;
      line-height: 1.1;
      letter-spacing: 0.01em;
    }

    .hero-sub {
      margin: 0;
      font-size: 0.9rem;
      color: rgba(255, 255, 255, 0.45);
      letter-spacing: 0.02em;
    }

    .hero-ctas {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .cta-primary {
      background: rgba(255, 255, 255, 0.14) !important;
      color: #fff !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      border-radius: 8px !important;
      font-weight: 600 !important;
    }

    .cta-primary:hover {
      background: rgba(255, 255, 255, 0.22) !important;
    }

    .cta-ghost {
      color: rgba(255, 255, 255, 0.65) !important;
      border-color: rgba(255, 255, 255, 0.15) !important;
      border-radius: 8px !important;
    }

    /* Right: inline metrics */
    .hero-metrics {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      flex-shrink: 0;
      min-width: 340px;
    }

    .hm-card {
      padding: 18px 20px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(4px);
    }

    .hm-value {
      display: block;
      font-size: 2rem;
      font-family: 'Bahnschrift', 'Arial Narrow', 'Segoe UI', sans-serif;
      color: #fff;
      line-height: 1;
      margin-bottom: 6px;
    }

    .hm-label {
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.45);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    /* ────────────────────────────────
       Events
    ──────────────────────────────── */
    .events-section,
    .tools-section {
      display: grid;
      gap: 16px;
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .events-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }

    .event-tile {
      display: grid;
      gap: 12px;
    }

    .tile-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .category-label {
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted);
      font-weight: 600;
    }

    .status-tag {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 700;
    }

    .status-tag.on-sale   { background: rgba(0,68,137,0.09);   color: var(--brand-primary); }
    .status-tag.low-stock { background: rgba(186,28,28,0.09);  color: var(--brand-accent);  }
    .status-tag.sold-out  { background: rgba(37,37,37,0.09);   color: var(--brand-ink);     }

    .event-tile h3   { font-size: 0.98rem; line-height: 1.3; }

    .tile-meta,
    .tile-desc {
      margin: 0;
      font-size: 0.83rem;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .tile-kpis {
      display: flex;
      gap: 20px;
      padding-top: 14px;
      border-top: 1px solid var(--surface-border);
    }

    .kpi          { display: grid; gap: 3px; }
    .kpi strong   { font-size: 1.05rem; }
    .kpi span     { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; }

    /* ────────────────────────────────
       Tools
    ──────────────────────────────── */
    .tools-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .tool-card {
      display: flex;
      align-items: center;
      gap: 16px;
      text-decoration: none;
      color: inherit;
      transition: box-shadow 0.2s ease, transform 0.18s ease;
    }

    .tool-card:hover {
      box-shadow: 0 10px 28px rgba(0,0,0,0.1);
      transform: translateY(-2px);
    }

    .tool-icon {
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      border-radius: 12px;
      background: rgba(0,68,137,0.07);
      flex-shrink: 0;
    }

    .tool-icon mat-icon { color: var(--brand-primary); }

    .tool-text        { flex: 1; }
    .tool-text strong { display: block; font-size: 0.95rem; margin-bottom: 4px; }
    .tool-text p      { margin: 0; font-size: 0.82rem; color: var(--text-muted); }
    .tool-arrow       { color: var(--text-muted); flex-shrink: 0; }

    /* ────────────────────────────────
       Responsive
    ──────────────────────────────── */
    @media (max-width: 1200px) {
      .hero-banner  { flex-direction: column; align-items: flex-start; }
      .hero-metrics { min-width: unset; width: 100%; }
      .events-grid  { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 768px) {
      .hero-banner   { padding: 28px 24px; }
      .hero-name     { font-size: 1.8rem; }
      .hero-metrics  { grid-template-columns: repeat(2, 1fr); }
      .events-grid,
      .tools-grid    { grid-template-columns: 1fr; }
      .section-head  { flex-direction: column; align-items: flex-start; }
      .hero-ctas     { flex-direction: column; }
    }
  `]
})
export class OverviewComponent {
  private readonly auth    = inject(AuthService);
  private readonly booking = inject(BookingService);
  private readonly events  = inject(EventService);

  readonly user$           = this.auth.user$;
  readonly featuredEvents$ = this.events.getFeaturedEvents().pipe(map((items) => items.slice(0, 3)));

  readonly stats$ = combineLatest([this.booking.getReservations(), this.events.getFeaturedEvents()]).pipe(
    map(([bookings, featured]) => {
      const ticketCount = bookings.reduce((sum, b) => sum + b.seats.length, 0);
      const revenue     = bookings.reduce((sum, b) => sum + b.totals.total, 0);
      return [
        { label: 'Ordenes registradas',  value: bookings.length },
        { label: 'Tickets emitidos',     value: ticketCount },
        { label: 'Eventos monitoreados', value: featured.length },
        { label: 'Ingresos simulados',   value: `Q${Math.round(revenue).toLocaleString()}` }
      ];
    })
  );

  statusLabel(event: EventItem): string {
    return event.status === 'on-sale'   ? 'Activo'
         : event.status === 'low-stock' ? 'Baja disponibilidad'
         :                               'Agotado';
  }
}
