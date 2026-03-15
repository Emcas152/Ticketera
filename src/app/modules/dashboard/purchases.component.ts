import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { BookingService } from '../../core/services/booking.service';
import { CurrencyGtqPipe } from '../../shared/pipes/currency-gtq.pipe';

@Component({
  selector: 'app-purchases',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, CurrencyGtqPipe],
  template: `
    <section class="panel-surface">
      <p class="eyebrow">Billing</p>
      <h1>Historial de compras</h1>

      <div class="purchase-row" *ngFor="let booking of bookings$ | async">
        <div>
          <strong>{{ booking.orderNumber }}</strong>
          <p>{{ booking.eventName }} · {{ booking.createdAt | date: 'short' }}</p>
        </div>
        <div class="purchase-meta">
          <span>{{ booking.paymentMethod }}</span>
          <strong>{{ booking.totals.total | currencyGtq }}</strong>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .purchase-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 16px 0;
        border-bottom: 1px solid rgba(8, 15, 30, 0.08);
      }

      .purchase-row p,
      .purchase-meta span {
        color: var(--text-muted);
      }

      .purchase-meta {
        text-align: right;
      }

      @media (max-width: 768px) {
        .purchase-row {
          flex-direction: column;
        }

        .purchase-meta {
          text-align: left;
        }
      }
    `
  ]
})
export class PurchasesComponent {
  private readonly booking = inject(BookingService);
  readonly bookings$ = this.booking.getReservations();
}
