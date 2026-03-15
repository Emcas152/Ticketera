import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { combineLatest, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { BookingService } from '../../core/services/booking.service';
import { EventService } from '../../core/services/event.service';
import { EventCardComponent } from '../../shared/components/event-card/event-card.component';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, AsyncPipe, EventCardComponent],
  template: `
    <section class="dashboard-grid">
      <article class="panel-surface hero-summary">
        <p class="eyebrow">Dashboard</p>
        <h1>Hola, {{ (user$ | async)?.fullName }}</h1>
        <p class="section-copy">Vista consolidada de tickets, compras y eventos sugeridos.</p>
      </article>

      <article class="stats-grid">
        <div class="panel-surface stat-card" *ngFor="let stat of stats$ | async">
          <strong>{{ stat.value }}</strong>
          <span>{{ stat.label }}</span>
        </div>
      </article>
    </section>

    <section class="recommended-shell">
      <div class="section-header">
        <div>
          <p class="eyebrow">Recommended</p>
          <h2>Proximos eventos sugeridos</h2>
        </div>
      </div>

      <div class="recommended-grid">
        <app-event-card *ngFor="let event of featuredEvents$ | async" [event]="event" />
      </div>
    </section>
  `,
  styles: [
    `
      .dashboard-grid {
        display: grid;
        gap: 24px;
      }

      .stats-grid,
      .recommended-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 20px;
      }

      .section-copy,
      .stat-card span {
        color: var(--text-muted);
      }

      .stat-card strong {
        display: block;
        font-size: 2rem;
      }

      .recommended-shell {
        margin-top: 24px;
      }

      @media (max-width: 1100px) {
        .stats-grid,
        .recommended-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class OverviewComponent {
  private readonly auth = inject(AuthService);
  private readonly booking = inject(BookingService);
  private readonly events = inject(EventService);

  readonly user$ = this.auth.user$;
  readonly featuredEvents$ = this.events.getFeaturedEvents();
  readonly stats$ = combineLatest([this.booking.getReservations(), this.events.getFeaturedEvents()]).pipe(
    map(([bookings, featured]) => {
      const ticketCount = bookings.reduce((sum, booking) => sum + booking.seats.length, 0);
      const spend = bookings.reduce((sum, booking) => sum + booking.totals.total, 0);

      return [
        { label: 'Reservas', value: bookings.length },
        { label: 'Tickets', value: ticketCount },
        { label: 'Eventos destacados', value: featured.length },
        { label: 'Total gastado', value: `Q${Math.round(spend)}` }
      ];
    })
  );
}
