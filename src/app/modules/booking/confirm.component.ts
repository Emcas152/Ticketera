import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookingRecord } from '../../core/models/booking.model';
import { BookingService } from '../../core/services/booking.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';
import { CurrencyGtqPipe } from '../../shared/pipes/currency-gtq.pipe';

@Component({
  selector: 'app-confirm',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, RouterLink, CurrencyGtqPipe, ...MATERIAL_IMPORTS],
  template: `
    <section class="page-shell" *ngIf="booking$ | async as booking">
      <article class="confirm-shell panel-surface">
        <div>
          <p class="eyebrow">Confirmed</p>
          <h1>Reserva confirmada</h1>
          <p class="section-copy">Orden {{ booking.orderNumber }} · {{ booking.createdAt | date: 'short' }}</p>
        </div>

        <div class="confirm-grid">
          <div class="ticket-card">
            <h2>{{ booking.eventName }}</h2>
            <p>{{ booking.eventDate | date: 'EEEE, d MMMM y' }} · {{ booking.venueName }}</p>
            <p>Asientos: {{ seatLabels(booking) }}</p>
            <p>Total: {{ booking.totals.total | currencyGtq }}</p>
          </div>

          <div class="qr-card">
            <div class="qr-placeholder">{{ booking.qrCode }}</div>
            <button mat-flat-button type="button" (click)="downloadTicket(booking)">Descargar ticket</button>
            <a mat-stroked-button routerLink="/dashboard/tickets">Ver mis tickets</a>
          </div>
        </div>
      </article>
    </section>
  `,
  styles: [
    `
      .confirm-shell,
      .confirm-grid {
        display: grid;
        gap: 24px;
      }

      .confirm-grid {
        grid-template-columns: minmax(0, 1fr) 320px;
      }

      .section-copy {
        color: var(--text-muted);
      }

      .ticket-card,
      .qr-card {
        padding: 24px;
        border-radius: 24px;
        background: rgba(15, 98, 254, 0.04);
      }

      .qr-card {
        justify-items: center;
      }

      .qr-placeholder {
        display: grid;
        place-items: center;
        width: 220px;
        height: 220px;
        border-radius: 24px;
        border: 12px solid rgba(7, 17, 27, 0.1);
        background:
          linear-gradient(45deg, rgba(7, 17, 27, 0.9) 25%, transparent 25%),
          linear-gradient(-45deg, rgba(7, 17, 27, 0.9) 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, rgba(7, 17, 27, 0.9) 75%),
          linear-gradient(-45deg, transparent 75%, rgba(7, 17, 27, 0.9) 75%);
        background-size: 36px 36px;
        background-position: 0 0, 0 18px, 18px -18px, -18px 0;
        color: white;
        font-weight: 700;
        text-align: center;
      }

      @media (max-width: 960px) {
        .confirm-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class ConfirmComponent {
  private readonly booking = inject(BookingService);
  readonly booking$ = this.booking.currentBooking$;

  seatLabels(booking: BookingRecord): string {
    return booking.seats.map((seat) => seat.label).join(', ');
  }

  downloadTicket(booking: BookingRecord): void {
    const content = [
      `Orden: ${booking.orderNumber}`,
      `Evento: ${booking.eventName}`,
      `Fecha: ${booking.eventDate}`,
      `Venue: ${booking.venueName}`,
      `Asientos: ${this.seatLabels(booking)}`,
      `Total: ${booking.totals.total}`,
      `QR: ${booking.qrCode}`
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${booking.orderNumber}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
