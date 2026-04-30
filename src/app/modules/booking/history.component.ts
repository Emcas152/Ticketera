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
    <section class="admin-shell">
      <div class="admin-header">
        <div>
          <p class="eyebrow">Booking history</p>
          <h1>Historial de reservas</h1>
          <p class="admin-subtitle">Vista tabular estilo admin para seguimiento de operaciones.</p>
        </div>
      </div>

      <article class="panel-surface">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Evento</th>
                <th>Orden</th>
                <th>Fecha</th>
                <th>Venue</th>
                <th>Asientos</th>
                <th>Estado</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let booking of bookings$ | async">
                <td>
                  <strong>{{ booking.eventName }}</strong>
                  <p>{{ booking.paymentMethod }}</p>
                </td>
                <td>{{ booking.orderNumber }}</td>
                <td>{{ booking.createdAt | date: 'd MMM y, h:mm a' }}</td>
                <td>{{ booking.venueName }}</td>
                <td>{{ booking.seats.length }}</td>
                <td>
                  <span class="status-pill" [class]="booking.status">{{ booking.status }}</span>
                </td>
                <td><strong>{{ booking.totals.total | currencyGtq }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `
})
export class HistoryComponent {
  private readonly booking = inject(BookingService);
  readonly bookings$ = this.booking.getReservations();
}
