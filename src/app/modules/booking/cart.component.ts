import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import { Seat } from '../../core/models/seat.model';
import { AuthService } from '../../core/services/auth.service';
import { BookingService } from '../../core/services/booking.service';
import { NotificationService } from '../../core/services/notification.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';
import { CurrencyGtqPipe } from '../../shared/pipes/currency-gtq.pipe';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule, RouterLink, CurrencyGtqPipe, ...MATERIAL_IMPORTS],
  template: `
    <section class="page-shell">
      <div class="section-header">
        <div>
          <p class="eyebrow">Checkout</p>
          <h1>Carrito de compra</h1>
          <p class="section-copy" *ngIf="event">{{ event.name }} · {{ event.date | date: 'd MMM' }}</p>
          <p class="section-copy">
            Puedes seleccionar asientos sin cuenta. Te pediremos iniciar sesión al confirmar la compra.
          </p>
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
          <div class="hold-banner" [class.expired]="holdExpired" *ngIf="seats.length > 0">
            <mat-icon>{{ holdExpired ? 'timer_off' : 'timer' }}</mat-icon>
            <div>
              <strong>{{ holdExpired ? 'Reserva expirada' : 'Reserva temporal' }}</strong>
              <p>{{ holdExpired ? 'Los asientos fueron liberados.' : 'Tiempo restante: ' + formattedRemaining }}</p>
            </div>
          </div>

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

          <form class="payment-form" [formGroup]="paymentForm" (ngSubmit)="confirmBooking()">
            <mat-form-field appearance="outline">
              <mat-label>Nombre en tarjeta</mat-label>
              <input matInput formControlName="cardholderName" autocomplete="cc-name" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Numero de tarjeta</mat-label>
              <input matInput formControlName="cardNumber" inputmode="numeric" autocomplete="cc-number" />
            </mat-form-field>

            <div class="payment-grid">
              <mat-form-field appearance="outline">
                <mat-label>MM/AA</mat-label>
                <input matInput formControlName="expiry" placeholder="12/29" autocomplete="cc-exp" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>CVV</mat-label>
                <input matInput formControlName="cvv" type="password" inputmode="numeric" autocomplete="cc-csc" />
              </mat-form-field>
            </div>

            <p class="payment-message error" *ngIf="paymentError">{{ paymentError }}</p>
            <p class="payment-message success" *ngIf="paymentStatus">{{ paymentStatus }}</p>

            <button mat-flat-button type="submit" [disabled]="seats.length === 0 || holdExpired || processingPayment">
              {{ processingPayment ? 'Procesando pago...' : 'Pagar y confirmar compra' }}
            </button>
          </form>
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

      .hold-banner {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 12px;
        border-radius: 12px;
        background: rgba(255, 176, 32, 0.14);
        color: #6b4100;
      }

      .hold-banner.expired {
        background: rgba(220, 38, 38, 0.1);
        color: #991b1b;
      }

      .hold-banner p,
      .payment-message {
        margin: 2px 0 0;
      }

      .payment-form {
        display: grid;
        gap: 10px;
        margin-top: 6px;
      }

      .payment-grid {
        display: grid;
        grid-template-columns: 1fr 112px;
        gap: 10px;
      }

      .payment-message.error {
        color: #b91c1c;
      }

      .payment-message.success {
        color: #047857;
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
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly booking = inject(BookingService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  event = this.booking.getSelectedEvent();
  seats: Seat[] = [];
  totals = this.booking.getTotals([]);
  holdExpiresAt: string | null = this.booking.getHoldExpiresAt();
  remainingSeconds = 0;
  holdExpired = false;
  processingPayment = false;
  paymentError = '';
  paymentStatus = '';
  readonly paymentForm = this.fb.group({
    cardholderName: ['', [Validators.required, Validators.minLength(3)]],
    cardNumber: ['', [Validators.required, Validators.pattern(/^[0-9 ]{13,23}$/)]],
    expiry: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]]
  });

  constructor() {
    this.booking.cart$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((cart) => {
      this.seats = cart.seats;
      this.totals = this.booking.getTotals(cart.seats);
      this.event = this.booking.getSelectedEvent();
      this.holdExpiresAt = cart.holdExpiresAt;
      this.updateRemainingTime();
    });

    interval(1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.holdExpiresAt = this.booking.getHoldExpiresAt();
      this.updateRemainingTime();
    });
  }

  get formattedRemaining(): string {
    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  confirmBooking(): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: '/booking/cart' }
      });
      return;
    }

    this.paymentError = '';
    this.paymentStatus = '';

    if (this.holdExpired || this.seats.length === 0) {
      this.notifications.info('Selecciona asientos disponibles para iniciar una nueva reserva.');
      return;
    }

    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      this.paymentError = 'Completa los datos de tarjeta para procesar el pago.';
      return;
    }

    this.processingPayment = true;
    this.booking.processPayment(this.paymentForm.getRawValue()).subscribe({
      next: (result) => {
        if (result.status === 'declined') {
          this.processingPayment = false;
          this.paymentError = result.message;
          return;
        }

        this.paymentStatus = result.message;
        this.booking.confirmReservation(result.paymentMethod).subscribe({
          next: () => this.router.navigate(['/booking/confirm']),
          error: (error: Error) => {
            this.processingPayment = false;
            this.paymentError = error.message;
          }
        });
      },
      error: (error: Error) => {
        this.processingPayment = false;
        this.paymentError = error.message;
      }
    });
  }

  private updateRemainingTime(): void {
    if (!this.holdExpiresAt || this.seats.length === 0) {
      this.remainingSeconds = 0;
      this.holdExpired = false;
      return;
    }

    this.remainingSeconds = Math.max(
      0,
      Math.ceil((new Date(this.holdExpiresAt).getTime() - Date.now()) / 1000)
    );
    this.holdExpired = this.remainingSeconds === 0;
  }
}
