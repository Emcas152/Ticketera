import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Seat } from '../../core/models/seat.model';
import { BookingService } from '../../core/services/booking.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';
import { CurrencyGtqPipe } from '../../shared/pipes/currency-gtq.pipe';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, CurrencyGtqPipe, ...MATERIAL_IMPORTS],
  template: `
    <section class="page-shell">
      <div class="section-header">
        <div>
          <p class="eyebrow">Checkout</p>
          <h1>Carrito de compra</h1>
          <p class="section-copy" *ngIf="event">{{ event.name }} · {{ event.date | date: 'd MMM' }}</p>
        </div>
      </div>

      <div class="cart-layout">
        <article class="panel-surface">
          <div class="cart-row" *ngFor="let seat of seats">
            <div>
              <strong>{{ seat.label }}</strong>
              <p>{{ seat.section }}</p>
            </div>
            <span>{{ seat.price | currencyGtq }}</span>
          </div>

          <div class="empty" *ngIf="seats.length === 0">
            <p>No hay asientos seleccionados.</p>
            <a mat-stroked-button routerLink="/events">Explorar eventos</a>
          </div>
        </article>

        <aside class="panel-surface summary-panel">
          <h2>Resumen</h2>
          <div class="summary-line">
            <span>Subtotal</span>
            <strong>{{ totals.subtotal | currencyGtq }}</strong>
          </div>
          <div class="summary-line">
            <span>Service fee</span>
            <strong>{{ totals.serviceFee | currencyGtq }}</strong>
          </div>
          <div class="summary-line">
            <span>Impuestos</span>
            <strong>{{ totals.taxes | currencyGtq }}</strong>
          </div>
          <mat-divider></mat-divider>
          <div class="summary-line total">
            <span>Total</span>
            <strong>{{ totals.total | currencyGtq }}</strong>
          </div>

          <button mat-flat-button type="button" (click)="confirmBooking()" [disabled]="seats.length === 0">
            Confirmar compra
          </button>
        </aside>
      </div>
    </section>
  `,
  styles: [
    `
      .cart-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 360px;
        gap: 24px;
      }

      .cart-row,
      .summary-line {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 0;
        border-bottom: 1px solid rgba(8, 15, 30, 0.08);
      }

      .cart-row p,
      .section-copy,
      .empty p {
        margin: 4px 0 0;
        color: var(--text-muted);
      }

      .summary-panel {
        display: grid;
        gap: 12px;
        align-content: start;
      }

      .total {
        font-size: 1.1rem;
      }

      .empty {
        display: grid;
        gap: 12px;
      }

      @media (max-width: 960px) {
        .cart-layout {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class CartComponent {
  private readonly booking = inject(BookingService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  event = this.booking.getSelectedEvent();
  seats: Seat[] = [];
  totals = this.booking.getTotals([]);

  constructor() {
    this.booking.cart$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((cart) => {
      this.seats = cart.seats;
      this.totals = this.booking.getTotals(cart.seats);
      this.event = this.booking.getSelectedEvent();
    });
  }

  confirmBooking(): void {
    this.booking.confirmReservation().subscribe(() => this.router.navigate(['/booking/confirm']));
  }
}
