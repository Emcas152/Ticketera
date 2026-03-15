import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { BookingService } from '../../core/services/booking.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';
import { CurrencyGtqPipe } from '../../shared/pipes/currency-gtq.pipe';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, CurrencyGtqPipe, ...MATERIAL_IMPORTS],
  template: `
    <section class="page-shell">
      <div class="section-header">
        <div>
          <p class="eyebrow">Booking history</p>
          <h1>Historial de reservas</h1>
        </div>
      </div>

      <div class="history-grid">
        <article class="panel-surface" *ngFor="let booking of bookings$ | async">
          <div class="history-head">
            <div>
              <strong>{{ booking.eventName }}</strong>
              <p>{{ booking.eventDate | date: 'd MMM y, h:mm a' }}</p>
            </div>
            <mat-chip>{{ booking.status }}</mat-chip>
          </div>
          <p>{{ booking.venueName }}</p>
          <p>Orden {{ booking.orderNumber }}</p>
          <p>Asientos: {{ booking.seats.length }}</p>
          <strong>{{ booking.totals.total | currencyGtq }}</strong>
        </article>
      </div>
    </section>
  `,
  styles: [
    `
      .history-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 20px;
      }

      .history-head {
        display: flex;
        justify-content: space-between;
        gap: 16px;
      }

      .history-head p,
      .history-grid p {
        color: var(--text-muted);
      }

      @media (max-width: 1100px) {
        .history-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 768px) {
        .history-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class HistoryComponent {
  private readonly booking = inject(BookingService);
  readonly bookings$ = this.booking.getReservations();
}
