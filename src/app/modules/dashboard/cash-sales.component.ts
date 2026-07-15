import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { BookingRecord } from '../../core/models/booking.model';
import { EventItem, EventPriceTier } from '../../core/models/event.model';
import { BookingService } from '../../core/services/booking.service';
import { EventService } from '../../core/services/event.service';
import { TicketPdfService } from '../../core/services/ticket-pdf.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';
import { CurrencyGtqPipe } from '../../shared/pipes/currency-gtq.pipe';

@Component({
  selector: 'app-cash-sales',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, ReactiveFormsModule, CurrencyGtqPipe, ...MATERIAL_IMPORTS],
  template: `
    <section class="admin-shell cash-sales">
      <div class="admin-header">
        <div>
          <p class="eyebrow">Ventas en efectivo</p>
          <h1>Venta manual</h1>
          <p class="admin-subtitle">Registra una venta en taquilla, genera la entrada y descarga el PDF.</p>
        </div>
      </div>

      <div class="cash-layout">
        <form class="panel-surface sale-form" [formGroup]="form" (ngSubmit)="registerSale()">
          <div class="form-title">
            <strong>Registrar venta</strong>
            <span>{{ total | currencyGtq }}</span>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Evento</mat-label>
            <mat-select formControlName="eventId" (selectionChange)="onEventChange()">
              @for (event of (events$ | async) ?? []; track event.id) {
                <mat-option [value]="event.id">{{ event.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Localidad</mat-label>
            <mat-select formControlName="tierName">
              @for (tier of selectedEvent?.priceTiers ?? []; track tier.name) {
                <mat-option [value]="tier.name">{{ tier.name }} - {{ tier.price | currencyGtq }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Cantidad</mat-label>
              <input matInput type="number" min="1" max="20" formControlName="quantity" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Cliente</mat-label>
              <input matInput formControlName="customerName" />
            </mat-form-field>
          </div>

          <div class="sale-summary">
            <div>
              <span>Metodo</span>
              <strong>Efectivo</strong>
            </div>
            <div>
              <span>Entradas</span>
              <strong>{{ form.controls.quantity.value }}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{{ total | currencyGtq }}</strong>
            </div>
          </div>

          <button mat-flat-button color="primary" type="submit">
            <mat-icon>point_of_sale</mat-icon>
            Registrar y generar entrada
          </button>
        </form>

        <article class="panel-surface last-ticket">
          <div class="ticket-head">
            <div>
              <strong>Ultima entrada generada</strong>
              <p *ngIf="!lastBooking">Aun no hay una venta manual en esta sesion.</p>
            </div>
            <mat-icon>confirmation_number</mat-icon>
          </div>

          <ng-container *ngIf="lastBooking">
            <div class="ticket-card">
              <span class="ticket-code">{{ lastBooking.orderNumber }}</span>
              <h2>{{ lastBooking.eventName }}</h2>
              <p>{{ lastBooking.eventDate | date: 'EEEE, d MMM y' }}</p>
              <div class="ticket-grid">
                <div>
                  <span>Entradas</span>
                  <strong>{{ lastBooking.seats.length }}</strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong>{{ lastBooking.totals.total | currencyGtq }}</strong>
                </div>
                <div>
                  <span>Pago</span>
                  <strong>Efectivo</strong>
                </div>
              </div>
            </div>
            <button mat-stroked-button type="button" (click)="download(lastBooking)">
              <mat-icon>picture_as_pdf</mat-icon>
              Descargar PDF
            </button>
          </ng-container>
        </article>

        <article class="panel-surface recent-sales">
          <div class="table-title">
            <strong>Ventas recientes</strong>
            <span>{{ (cashBookings$ | async)?.length ?? 0 }} registros</span>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Evento</th>
                  <th>Entradas</th>
                  <th>Total</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                @for (booking of (cashBookings$ | async) ?? []; track booking.id) {
                  <tr>
                    <td>{{ booking.orderNumber }}</td>
                    <td>
                      <strong>{{ booking.eventName }}</strong>
                      <p>{{ booking.createdAt | date: 'd MMM, h:mm a' }}</p>
                    </td>
                    <td>{{ booking.seats.length }}</td>
                    <td>{{ booking.totals.total | currencyGtq }}</td>
                    <td>
                      <button mat-icon-button type="button" (click)="download(booking)">
                        <mat-icon>download</mat-icon>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  `,
  styles: [`
    .cash-layout {
      display: grid;
      grid-template-columns: minmax(340px, 420px) minmax(280px, 360px);
      gap: 20px;
      align-items: start;
    }

    .recent-sales {
      grid-column: 1 / -1;
    }

    .sale-form,
    .last-ticket,
    .recent-sales {
      display: grid;
      gap: 16px;
    }

    .form-title,
    .ticket-head,
    .table-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .form-title span {
      font-size: 1.35rem;
      font-family: 'Bahnschrift', 'Segoe UI', sans-serif;
      font-weight: 800;
      color: var(--brand-primary);
    }

    .form-grid {
      display: grid;
      grid-template-columns: 130px 1fr;
      gap: 12px;
    }

    .sale-summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .sale-summary div,
    .ticket-grid div {
      padding: 14px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1px solid var(--surface-border);
    }

    .sale-summary span,
    .ticket-grid span,
    .ticket-head p,
    .table-title span,
    .ticket-card p {
      display: block;
      margin: 0 0 4px;
      color: var(--text-muted);
      font-size: 0.82rem;
    }

    .ticket-card {
      display: grid;
      gap: 14px;
      padding: 20px;
      border-radius: 16px;
      background: linear-gradient(135deg, #101b2e, #17345d);
      color: #fff;
    }

    .ticket-card p,
    .ticket-grid span {
      color: rgba(255, 255, 255, 0.68);
    }

    .ticket-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .ticket-grid div {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.12);
    }

    .ticket-code {
      width: fit-content;
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
      font-weight: 800;
      font-size: 0.78rem;
    }

    @media (max-width: 980px) {
      .cash-layout {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .form-grid,
      .sale-summary,
      .ticket-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class CashSalesComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly events = inject(EventService);
  private readonly booking = inject(BookingService);
  private readonly ticketPdf = inject(TicketPdfService);

  readonly events$ = this.events.events$.pipe(map((events) => events.filter((event) => event.status !== 'draft')));
  readonly cashBookings$ = this.booking
    .getReservations()
    .pipe(map((bookings) => bookings.filter((booking) => booking.paymentMethod.startsWith('Efectivo'))));

  selectedEvent: EventItem | null = null;
  lastBooking: BookingRecord | null = null;

  readonly form = this.fb.group({
    eventId: ['', Validators.required],
    tierName: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1), Validators.max(20)]],
    customerName: ['']
  });

  get selectedTier(): EventPriceTier | null {
    return this.selectedEvent?.priceTiers.find((tier) => tier.name === this.form.controls.tierName.value) ?? null;
  }

  get total(): number {
    return (this.selectedTier?.price ?? 0) * this.form.controls.quantity.value * 1.14;
  }

  onEventChange(): void {
    const eventId = this.form.controls.eventId.value;
    this.events.events$.subscribe((events) => {
      this.selectedEvent = events.find((event) => event.id === eventId) ?? null;
      this.form.controls.tierName.setValue(this.selectedEvent?.priceTiers[0]?.name ?? '');
    }).unsubscribe();
  }

  registerSale(): void {
    if (this.form.invalid || !this.selectedEvent || !this.selectedTier) {
      this.form.markAllAsTouched();
      return;
    }

    this.booking
      .recordManualCashSale(
        this.selectedEvent,
        this.selectedTier,
        this.form.controls.quantity.value,
        this.form.controls.customerName.value.trim()
      )
      .subscribe((booking) => {
        this.lastBooking = booking;
      });
  }

  async download(booking: BookingRecord): Promise<void> {
    await this.ticketPdf.downloadTicket(booking);
  }
}
