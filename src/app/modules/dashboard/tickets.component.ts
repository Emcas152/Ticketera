import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { BookingRecord } from '../../core/models/booking.model';
import { BookingService } from '../../core/services/booking.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';
import { CurrencyGtqPipe } from '../../shared/pipes/currency-gtq.pipe';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, CurrencyGtqPipe, ...MATERIAL_IMPORTS],
  template: `
    <section class="tickets-grid">
      <article class="panel-surface ticket-card" *ngFor="let booking of bookings$ | async">
        <div>
          <p class="eyebrow">Ticket</p>
          <h2>{{ booking.eventName }}</h2>
          <p>{{ booking.eventDate | date: 'EEEE, d MMM y' }}</p>
        </div>
        <div class="ticket-meta">
          <span>{{ booking.seats.length }} asientos</span>
          <strong>{{ booking.totals.total | currencyGtq }}</strong>
        </div>
        <div class="ticket-actions">
          <span>{{ booking.qrCode }}</span>
          <button mat-stroked-button type="button" (click)="downloadTicket(booking)">Descargar</button>
        </div>
      </article>
    </section>
  `,
  styles: [
    `
      .tickets-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 20px;
      }

      .ticket-card,
      .ticket-meta,
      .ticket-actions {
        display: grid;
        gap: 14px;
      }

      .ticket-card p {
        color: var(--text-muted);
      }

      @media (max-width: 960px) {
        .tickets-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class TicketsComponent {
  private readonly booking = inject(BookingService);
  readonly bookings$ = this.booking.getReservations();

  downloadTicket(booking: BookingRecord): void {
    const content = `${booking.orderNumber}\n${booking.eventName}\n${booking.qrCode}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${booking.orderNumber}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
