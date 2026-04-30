import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BookingRecord } from '../../core/models/booking.model';
import { BookingService } from '../../core/services/booking.service';
import { TicketPdfService } from '../../core/services/ticket-pdf.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';
import { CurrencyGtqPipe } from '../../shared/pipes/currency-gtq.pipe';

@Component({
  selector: 'app-confirm',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, RouterLink, CurrencyGtqPipe, ...MATERIAL_IMPORTS],
  template: `
    <section class="page-shell" *ngIf="booking$ | async as booking; else pendingOrEmpty">
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

    <ng-template #pendingOrEmpty>
      <section class="page-shell">
        <article class="confirm-shell panel-surface empty-state">
          <h1>Procesando compra</h1>
          <p class="section-copy" *ngIf="hasPendingSeats; else noSelection">
            Completa el pago en el carrito para confirmar tu compra.
          </p>
          <ng-template #noSelection>
            <p class="section-copy">No hay una compra pendiente. Vuelve al catálogo para elegir un evento.</p>
          </ng-template>
          <a mat-stroked-button routerLink="/events">Ir a eventos</a>
        </article>
      </section>
    </ng-template>
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

      .empty-state {
        justify-items: start;
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
  private readonly ticketPdf = inject(TicketPdfService);
  private readonly destroyRef = inject(DestroyRef);
  readonly booking$ = this.booking.currentBooking$;
  hasPendingSeats = this.booking.getSelectedSeats().length > 0;

  constructor() {
    this.booking.currentBooking$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((booking) => {
        this.hasPendingSeats = this.booking.getSelectedSeats().length > 0;

      });
  }

  seatLabels(booking: BookingRecord): string {
    return booking.seats.map((seat) => seat.label).join(', ');
  }

  async downloadTicket(booking: BookingRecord): Promise<void> {
    await this.ticketPdf.downloadTicket(booking);
  }
}
