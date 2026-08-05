import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import {
  AdminBooking,
  AdminBookingFilters,
  AdminBookingStatus
} from '../../core/models/admin-booking.model';
import { EventItem } from '../../core/models/event.model';
import { AdminBookingService } from '../../core/services/admin-booking.service';
import { EventService } from '../../core/services/event.service';
import { NotificationService } from '../../core/services/notification.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

const EMPTY_FILTERS = {
  status: '' as AdminBookingStatus | '',
  event_id: '',
  search: '',
  date_from: '',
  date_to: ''
};

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ...MATERIAL_IMPORTS],
  template: `
    <section class="reservations-page">
      <header>
        <div>
          <p class="eyebrow">Operación</p>
          <h1>Estado de reservas</h1>
          <p>Consulta reservas, pagos en proceso y ventas confirmadas usando filtros del servidor.</p>
        </div>
        <div class="total-card">
          <strong>{{ total() }}</strong>
          <span>resultados</span>
        </div>
      </header>

      <form class="filters panel-surface" [formGroup]="filters">
        <mat-form-field appearance="outline">
          <mat-label>Buscar</mat-label>
          <input matInput formControlName="search" placeholder="Referencia, cliente, correo o teléfono" />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Estado</mat-label>
          <mat-select formControlName="status">
            <mat-option value="">Todos</mat-option>
            @for (option of statuses; track option.value) {
              <mat-option [value]="option.value">{{ option.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Evento</mat-label>
          <mat-select formControlName="event_id">
            <mat-option value="">Todos</mat-option>
            @for (event of events(); track event.id) {
              <mat-option [value]="event.id">{{ event.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Desde</mat-label>
          <input matInput type="date" formControlName="date_from" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Hasta</mat-label>
          <input matInput type="date" formControlName="date_to" />
        </mat-form-field>

        <button mat-stroked-button type="button" (click)="clearFilters()" [disabled]="loading()">
          <mat-icon>filter_alt_off</mat-icon>
          Limpiar
        </button>
      </form>

      @if (dateError()) {
        <div class="notice error" role="alert">La fecha final no puede ser anterior a la inicial.</div>
      }

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (error()) {
        <div class="notice error" role="alert">
          <span>{{ error() }}</span>
          <button mat-button type="button" (click)="load()">Reintentar</button>
        </div>
      } @else if (!loading() && reservations().length === 0) {
        <div class="empty panel-surface">
          <mat-icon>event_busy</mat-icon>
          <h2>No se encontraron reservas</h2>
          <p>Cambia o limpia los filtros para ampliar la búsqueda.</p>
        </div>
      } @else {
        <div class="table-shell panel-surface">
          <table mat-table [dataSource]="reservations()">
            <ng-container matColumnDef="reference">
              <th mat-header-cell *matHeaderCellDef>Referencia</th>
              <td mat-cell *matCellDef="let item"><strong>{{ item.reference }}</strong></td>
            </ng-container>
            <ng-container matColumnDef="event">
              <th mat-header-cell *matHeaderCellDef>Evento</th>
              <td mat-cell *matCellDef="let item">{{ item.event?.title || 'Sin evento' }}</td>
            </ng-container>
            <ng-container matColumnDef="customer">
              <th mat-header-cell *matHeaderCellDef>Cliente / teléfono</th>
              <td mat-cell *matCellDef="let item">
                <span>{{ item.customer?.name || 'Invitado' }}</span>
                <small>{{ item.customer?.email || 'Sin correo' }}</small>
                <small class="customer-phone">
                  <mat-icon>phone</mat-icon>{{ customerPhone(item) || 'Sin teléfono' }}
                </small>
              </td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Estado</th>
              <td mat-cell *matCellDef="let item">
                <span class="status" [class]="'status ' + item.status">{{ statusLabel(item.status) }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="seats">
              <th mat-header-cell *matHeaderCellDef>Mesa / asientos</th>
              <td mat-cell *matCellDef="let item">
                <div class="seat-list">
                  @for (seat of item.seats; track seat.id) {
                    <span class="seat-chip">
                      <strong>{{ seat.section || 'Sin sección' }}</strong>
                      {{ seatLabel(seat) }}
                    </span>
                  } @empty {
                    <span class="muted">Sin asientos asociados</span>
                  }
                </div>
              </td>
            </ng-container>
            <ng-container matColumnDef="expires">
              <th mat-header-cell *matHeaderCellDef>Vencimiento</th>
              <td mat-cell *matCellDef="let item">
                {{ item.reserved_until ? (item.reserved_until | date:'dd/MM/yyyy HH:mm') : '—' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="total">
              <th mat-header-cell *matHeaderCellDef>Total</th>
              <td mat-cell *matCellDef="let item">{{ item.total | currency:'GTQ':'symbol-narrow' }}</td>
            </ng-container>
            <ng-container matColumnDef="created">
              <th mat-header-cell *matHeaderCellDef>Creada</th>
              <td mat-cell *matCellDef="let item">
                {{ item.created_at ? (item.created_at | date:'dd/MM/yyyy HH:mm') : '—' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Acciones</th>
              <td mat-cell *matCellDef="let item">
                @if (canRelease(item)) {
                  <button
                    mat-stroked-button
                    type="button"
                    color="warn"
                    (click)="releaseSeats(item)"
                    [disabled]="releasingId() === item.id"
                    [attr.aria-label]="'Liberar asientos de la reserva ' + item.reference">
                    <mat-icon>{{ releasingId() === item.id ? 'hourglass_top' : 'event_available' }}</mat-icon>
                    {{ releasingId() === item.id ? 'Liberando...' : 'Liberar' }}
                  </button>
                } @else {
                  <span class="muted">{{ item.release_block_reason || releaseUnavailableLabel(item.status) }}</span>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>

        <nav class="pagination" aria-label="Paginación de reservas">
          <button mat-stroked-button type="button" (click)="changePage(page() - 1)" [disabled]="page() <= 1 || loading()">
            <mat-icon>chevron_left</mat-icon> Anterior
          </button>
          <span>Página {{ page() }} de {{ lastPage() }}</span>
          <button mat-stroked-button type="button" (click)="changePage(page() + 1)" [disabled]="page() >= lastPage() || loading()">
            Siguiente <mat-icon>chevron_right</mat-icon>
          </button>
        </nav>
      }
    </section>
  `,
  styles: [`
    .reservations-page { display: grid; gap: 18px; }
    header { display: flex; justify-content: space-between; gap: 20px; align-items: end; }
    header h1, header p { margin-bottom: 4px; }
    .total-card { min-width: 120px; padding: 14px 18px; border-radius: 14px; background: #111; color: #fff; text-align: center; }
    .total-card strong, .total-card span, td small { display: block; }
    .total-card strong { font-size: 1.65rem; }
    .total-card span, td small { font-size: .75rem; opacity: .65; }
    .filters { display: grid; grid-template-columns: 1.5fr repeat(4, minmax(140px, 1fr)) auto; gap: 12px; align-items: center; padding: 16px; }
    .filters mat-form-field { width: 100%; }
    .table-shell { overflow-x: auto; }
    table { width: 100%; min-width: 980px; }
    .status { display: inline-flex; padding: 5px 9px; border-radius: 999px; font-size: .75rem; font-weight: 700; background: #e5e7eb; }
    .status.pagado, .status.confirmado { color: #166534; background: #dcfce7; }
    .status.reservado { color: #92400e; background: #fef3c7; }
    .status.proceso_pago, .status.pendiente { color: #1e40af; background: #dbeafe; }
    .status.cancelado, .status.expirado { color: #991b1b; background: #fee2e2; }
    .seat-list { display: grid; gap: 5px; min-width: 190px; padding: 6px 0; }
    .seat-chip { display: flex; gap: 5px; align-items: baseline; font-size: .76rem; }
    .seat-chip strong { color: var(--brand-primary); }
    .customer-phone { display: flex !important; align-items: center; gap: 4px; margin-top: 3px; }
    .customer-phone mat-icon { width: 14px; height: 14px; font-size: 14px; }
    .muted { color: var(--text-muted); font-size: .78rem; }
    .notice, .empty { padding: 20px; border-radius: 12px; }
    .notice { display: flex; justify-content: space-between; align-items: center; }
    .notice.error { color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; }
    .empty { text-align: center; padding: 48px 20px; }
    .empty mat-icon { width: 42px; height: 42px; font-size: 42px; opacity: .45; }
    .pagination { display: flex; justify-content: flex-end; align-items: center; gap: 16px; }
    @media (max-width: 1200px) { .filters { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 680px) {
      header { align-items: stretch; flex-direction: column; }
      .filters { grid-template-columns: 1fr; }
      .pagination { justify-content: space-between; }
    }
  `]
})
export class ReservationsComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(AdminBookingService);
  private readonly eventService = inject(EventService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly filters = this.fb.group(EMPTY_FILTERS);
  readonly reservations = signal<AdminBooking[]>([]);
  readonly events = signal<EventItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly dateError = signal(false);
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly total = signal(0);
  readonly releasingId = signal<number | null>(null);
  readonly columns = ['reference', 'event', 'customer', 'status', 'seats', 'expires', 'total', 'created', 'actions'];
  readonly statuses: Array<{ value: AdminBookingStatus; label: string }> = [
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'reservado', label: 'Reservada' },
    { value: 'proceso_pago', label: 'Procesando pago' },
    { value: 'confirmado', label: 'Confirmada' },
    { value: 'pagado', label: 'Pagada' },
    { value: 'cancelado', label: 'Cancelada' },
    { value: 'expirado', label: 'Expirada' }
  ];

  constructor() {
    this.eventService.getEvents().pipe(takeUntilDestroyed()).subscribe({
      next: (events) => this.events.set(events)
    });
    this.filters.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged((previous, current) => JSON.stringify(previous) === JSON.stringify(current)),
      takeUntilDestroyed()
    ).subscribe(() => {
      this.page.set(1);
      this.load();
    });
    this.load();
  }

  load(): void {
    const raw = this.filters.getRawValue();
    if (raw.date_from && raw.date_to && raw.date_to < raw.date_from) {
      this.dateError.set(true);
      return;
    }

    this.dateError.set(false);
    this.loading.set(true);
    this.error.set('');
    const query: AdminBookingFilters = {
      ...raw,
      search: raw.search.trim(),
      page: this.page(),
      per_page: 20
    };

    this.service.list(query).pipe(
      finalize(() => this.loading.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.reservations.set(response.data);
        this.page.set(response.meta.current_page);
        this.lastPage.set(Math.max(response.meta.last_page, 1));
        this.total.set(response.meta.total);
      },
      error: () => this.error.set('No fue posible cargar las reservas. Verifica la API e intenta nuevamente.')
    });
  }

  clearFilters(): void {
    this.filters.reset(EMPTY_FILTERS);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.lastPage()) return;
    this.page.set(page);
    this.load();
  }

  statusLabel(status: AdminBookingStatus): string {
    return this.statuses.find((option) => option.value === status)?.label ?? status;
  }

  seatLabel(seat: AdminBooking['seats'][number]): string {
    if (seat.number_table) {
      return `Mesa ${seat.number_table} · Asiento ${seat.seat_number}`;
    }
    if (seat.row_label) {
      return `Fila ${seat.row_label} · Asiento ${seat.seat_number}`;
    }
    return `Asiento ${seat.seat_number}`;
  }

  customerPhone(booking: AdminBooking): string {
    return booking.customer?.phone
      || booking.customer?.telefono
      || booking.customer?.customer_phone
      || booking.customer_phone
      || booking.phone
      || booking.telefono
      || '';
  }

  canRelease(booking: AdminBooking): boolean {
    return booking.can_release === true;
  }

  releaseUnavailableLabel(status: AdminBookingStatus): string {
    if (status === 'pagado' || status === 'confirmado') return 'Venta protegida';
    if (status === 'proceso_pago') return 'Pago en proceso';
    return 'Ya liberada';
  }

  releaseSeats(booking: AdminBooking): void {
    if (!this.canRelease(booking) || this.releasingId() !== null) return;

    const seats = booking.seats.length;
    const confirmed = window.confirm(
      `¿Liberar ${seats} asiento${seats === 1 ? '' : 's'} de la reserva ${booking.reference}? ` +
      'La reserva será cancelada y los asientos volverán a estar disponibles para compra.'
    );
    if (!confirmed) return;

    this.releasingId.set(booking.id);
    this.service.releaseSeats(booking.id).pipe(
      finalize(() => this.releasingId.set(null)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.notifications.success(
          `${response.data.released_seats} asiento${response.data.released_seats === 1 ? '' : 's'} liberado${response.data.released_seats === 1 ? '' : 's'}.`
        );
        this.load();
      }
    });
  }
}
