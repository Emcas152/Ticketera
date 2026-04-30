import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { BookingRecord } from '../../core/models/booking.model';
import { BookingService } from '../../core/services/booking.service';
import { TicketPdfService } from '../../core/services/ticket-pdf.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';
import { CurrencyGtqPipe } from '../../shared/pipes/currency-gtq.pipe';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, CurrencyGtqPipe, ...MATERIAL_IMPORTS],
  template: `
    <section class="admin-shell">
      <div class="admin-header">
        <div>
          <p class="eyebrow">Tickets</p>
          <h1>Tickets emitidos</h1>
          <p class="admin-subtitle">Listado operativo para descargar y validar tickets administrados.</p>
        </div>
      </div>

      <article class="panel-surface">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Evento</th>
                <th>Fecha</th>
                <th>QR</th>
                <th>Asientos</th>
                <th>Total</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let booking of bookings$ | async">
                <td>
                  <strong>{{ booking.eventName }}</strong>
                  <p>{{ booking.venueName }}</p>
                </td>
                <td>{{ booking.eventDate | date: 'EEEE, d MMM y' }}</td>
                <td>{{ booking.qrCode }}</td>
                <td>{{ seatLabels(booking) }}</td>
                <td><strong>{{ booking.totals.total | currencyGtq }}</strong></td>
                <td>
                  <button mat-stroked-button color="primary" type="button" (click)="downloadTicket(booking)">
                    Descargar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `
})
export class TicketsComponent {
  private readonly booking = inject(BookingService);
  private readonly ticketPdf = inject(TicketPdfService);
  readonly bookings$ = this.booking.getReservations();

  seatLabels(booking: BookingRecord): string {
    return booking.seats.map((seat) => seat.label).join(', ');
  }

  async downloadTicket(booking: BookingRecord): Promise<void> {
    await this.ticketPdf.downloadTicket(booking);
  }
}
