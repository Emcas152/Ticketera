import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { EventItem, EventPriceTier } from '../../core/models/event.model';
import { Seat, SeatMap } from '../../core/models/seat.model';
import { BookingService } from '../../core/services/booking.service';
import { EventService } from '../../core/services/event.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';
import { CurrencyGtqPipe } from '../../shared/pipes/currency-gtq.pipe';

@Component({
  selector: 'app-seat-map',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, CurrencyGtqPipe, ...MATERIAL_IMPORTS],
  template: `
    <section class="page-shell" *ngIf="event && seatMap">
      <div class="section-header">
        <div>
          <p class="eyebrow">Seat selection</p>
          <h1>{{ event.name }}</h1>
          <p class="section-copy">{{ event.date | date: 'EEEE, d MMM' }} · {{ event.time }} · {{ event.venueName }}</p>
        </div>
        <a mat-stroked-button routerLink="/events/{{ event.id }}">Volver al detalle</a>
      </div>

      <div class="seat-layout">
        <div class="panel-surface">
          <div class="stage">{{ seatMap.stageLabel }}</div>
          <div class="legend">
            <span><i class="dot available"></i> Disponible</span>
            <span><i class="dot reserved"></i> Reservado</span>
            <span><i class="dot sold"></i> Vendido</span>
            <span><i class="dot selected"></i> Seleccionado</span>
          </div>

          <div class="rows">
            <div class="row" *ngFor="let row of seatMap.rows">
              <span class="row-label">{{ row.label }}</span>
              <button
                type="button"
                class="seat"
                *ngFor="let seat of row.seats"
                [class.available]="getSeatStatus(seat) === 'available'"
                [class.reserved]="getSeatStatus(seat) === 'reserved'"
                [class.sold]="getSeatStatus(seat) === 'sold'"
                [class.selected]="getSeatStatus(seat) === 'selected'"
                (click)="toggleSeat(seat)"
              >
                {{ seat.number }}
              </button>
            </div>
          </div>
        </div>

        <aside class="panel-surface summary-panel">
          <h2>Resumen de compra</h2>
          <div class="price-tier" *ngFor="let tier of event.priceTiers">
            <div>
              <strong>{{ tier.name }}</strong>
              <p>{{ tier.description }}</p>
            </div>
            <span>{{ tier.price | currencyGtq }}</span>
          </div>

          <mat-divider></mat-divider>

          <div class="selected-list" *ngIf="selectedSeats.length; else emptySelection">
            <div class="selected-item" *ngFor="let seat of selectedSeats">
              <span>{{ seat.label }} · {{ seat.section }}</span>
              <strong>{{ seat.price | currencyGtq }}</strong>
            </div>
          </div>

          <ng-template #emptySelection>
            <p class="section-copy">Selecciona tus asientos para continuar al carrito.</p>
          </ng-template>

          <div class="total-row">
            <span>Total estimado</span>
            <strong>{{ totals.total | currencyGtq }}</strong>
          </div>

          <button mat-flat-button type="button" (click)="goToCart()" [disabled]="selectedSeats.length === 0">
            Ir al carrito
          </button>
        </aside>
      </div>
    </section>
  `,
  styles: [
    `
      .section-header,
      .seat-layout,
      .legend,
      .price-tier,
      .selected-item,
      .total-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
      }

      .seat-layout {
        align-items: start;
      }

      .seat-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 360px;
      }

      .section-copy,
      .price-tier p {
        color: var(--text-muted);
      }

      .stage {
        margin: 0 auto 24px;
        width: min(100%, 420px);
        text-align: center;
        padding: 14px;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(15, 98, 254, 0.16), rgba(255, 127, 17, 0.18));
      }

      .legend {
        flex-wrap: wrap;
        margin-bottom: 18px;
      }

      .dot {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        margin-right: 6px;
      }

      .rows {
        display: grid;
        gap: 10px;
      }

      .row {
        display: grid;
        grid-template-columns: 34px repeat(12, 1fr);
        gap: 8px;
        align-items: center;
      }

      .row-label {
        text-align: center;
        color: var(--text-muted);
      }

      .seat {
        height: 38px;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        font-weight: 700;
      }

      .available,
      .dot.available {
        background: rgba(15, 98, 254, 0.14);
        color: var(--brand-primary);
      }

      .reserved,
      .dot.reserved {
        background: rgba(255, 127, 17, 0.2);
        color: #9a3412;
      }

      .sold,
      .dot.sold {
        background: rgba(15, 23, 42, 0.18);
        color: #475569;
        cursor: not-allowed;
      }

      .selected,
      .dot.selected {
        background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
        color: white;
      }

      .summary-panel {
        display: grid;
        gap: 14px;
      }

      .price-tier p {
        margin: 4px 0 0;
      }

      .selected-list {
        display: grid;
        gap: 10px;
      }

      @media (max-width: 1100px) {
        .seat-layout {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 768px) {
        .row {
          gap: 4px;
        }

        .seat {
          height: 32px;
          border-radius: 8px;
          font-size: 0.75rem;
        }
      }
    `
  ]
})
export class SeatMapComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly events = inject(EventService);
  private readonly booking = inject(BookingService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  event?: EventItem;
  seatMap?: SeatMap;
  selectedSeatIds = new Set<string>();
  selectedSeats: Seat[] = [];
  totals = this.booking.getTotals([]);

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const eventId = params.get('eventId') ?? '';
          this.booking.setActiveEvent(eventId);
          return this.events.getEventById(eventId);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        this.event = event;

        if (event) {
          this.booking
            .getSeatMap(event.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((seatMap) => (this.seatMap = seatMap));
        }
      });

    this.booking.cart$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((cart) => {
      this.selectedSeats = cart.seats;
      this.selectedSeatIds = new Set(cart.seats.map((seat) => seat.id));
      this.totals = this.booking.getTotals(cart.seats);
    });
  }

  toggleSeat(seat: Seat): void {
    this.booking.toggleSeat(seat);
  }

  getSeatStatus(seat: Seat): Seat['status'] {
    return this.selectedSeatIds.has(seat.id) ? 'selected' : seat.status;
  }

  goToCart(): void {
    this.router.navigate(['/booking/cart']);
  }
}
