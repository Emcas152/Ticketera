import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import {
  AdminBooking,
  AdminBookingFilters,
  AdminBookingPayment,
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
        <div class="header-actions">
          <div class="total-card">
            <strong>{{ total() }}</strong>
            <span>resultados</span>
          </div>
          <button
            id="btn-export-excel"
            class="export-btn"
            type="button"
            [disabled]="reservations().length === 0 || exporting()"
            (click)="exportExcel()">
            <span class="export-icon material-icons">{{ exporting() ? 'hourglass_top' : 'download' }}</span>
            {{ exporting() ? 'Exportando...' : 'Exportar Excel' }}
          </button>
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
              <td mat-cell *matCellDef="let item" data-label="Referencia"><strong>{{ item.reference }}</strong></td>
            </ng-container>
            <ng-container matColumnDef="event">
              <th mat-header-cell *matHeaderCellDef>Evento</th>
              <td mat-cell *matCellDef="let item" data-label="Evento">{{ item.event?.title || 'Sin evento' }}</td>
            </ng-container>
            <ng-container matColumnDef="customer">
              <th mat-header-cell *matHeaderCellDef>Cliente / NIT</th>
              <td mat-cell *matCellDef="let item" data-label="Cliente / NIT">
                <strong>{{ item.customer?.name || 'Invitado' }}</strong>
                <small>{{ item.customer?.email || 'Sin correo' }}</small>
                <small class="customer-phone">
                  <mat-icon>phone</mat-icon>{{ customerPhone(item) || 'Sin teléfono' }}
                </small>
                <small class="customer-nit">
                  <mat-icon>badge</mat-icon>NIT: {{ customerNit(item) }}
                </small>
              </td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Estado</th>
              <td mat-cell *matCellDef="let item" data-label="Estado">
                <div class="status-detail">
                  <span class="status" [class]="'status ' + item.status">{{ statusLabel(item.status) }}</span>
                  @if (paymentDetail(item); as detail) {
                    <strong class="payment-result">{{ detail.title }}</strong>
                    <small class="payment-reason">{{ detail.message }}</small>
                    @if (detail.code) {
                      <small class="payment-code">Código: {{ detail.code }}</small>
                    }
                  }
                </div>
              </td>
            </ng-container>
            <ng-container matColumnDef="seats">
              <th mat-header-cell *matHeaderCellDef>Mesa / asientos</th>
              <td mat-cell *matCellDef="let item" data-label="Mesa / asientos">
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
              <td mat-cell *matCellDef="let item" data-label="Vencimiento">
                {{ item.reserved_until ? (item.reserved_until | date:'dd/MM/yyyy HH:mm') : '—' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="total">
              <th mat-header-cell *matHeaderCellDef>Total</th>
              <td mat-cell *matCellDef="let item" data-label="Total">{{ item.total | currency:'GTQ':'symbol-narrow' }}</td>
            </ng-container>
            <ng-container matColumnDef="created">
              <th mat-header-cell *matHeaderCellDef>Creada</th>
              <td mat-cell *matCellDef="let item" data-label="Creada">
                {{ item.created_at ? (item.created_at | date:'dd/MM/yyyy HH:mm') : '—' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Acciones</th>
              <td mat-cell *matCellDef="let item" data-label="Acciones">
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
    header { display: flex; justify-content: space-between; gap: 20px; align-items: end; flex-wrap: wrap; }
    header h1, header p { margin-bottom: 4px; }
    .header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .total-card { min-width: 120px; padding: 14px 18px; border-radius: 14px; background: #111; color: #fff; text-align: center; }
    .total-card strong, .total-card span, td small { display: block; }
    .total-card strong { font-size: 1.65rem; }
    .export-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 0 20px;
      height: 44px;
      background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
      color: #fff !important;
      border: none;
      border-radius: 10px;
      font-size: .875rem;
      font-weight: 600;
      letter-spacing: .01em;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(22,163,74,.35);
      transition: opacity .18s, transform .12s, box-shadow .18s;
      white-space: nowrap;
    }
    .export-btn:hover:not(:disabled) {
      opacity: .92;
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(22,163,74,.45);
    }
    .export-btn:active:not(:disabled) { transform: translateY(0); }
    .export-btn:disabled { opacity: .45; cursor: not-allowed; }
    .export-icon { font-size: 18px; width: 18px; height: 18px; line-height: 1; }
    .total-card span, td small { font-size: .75rem; opacity: .65; }
    .filters { display: grid; grid-template-columns: 1.5fr repeat(4, minmax(140px, 1fr)) auto; gap: 12px; align-items: center; padding: 16px; }
    .filters mat-form-field { width: 100%; }
    /* ── Desktop table ── */
    .table-shell { overflow-x: auto; border-radius: 12px; }
    table { width: 100%; min-width: 980px; }
    .status { display: inline-flex; padding: 5px 9px; border-radius: 999px; font-size: .75rem; font-weight: 700; background: #e5e7eb; }
    .status.pagado, .status.confirmado { color: #166534; background: #dcfce7; }
    .status.reservado { color: #92400e; background: #fef3c7; }
    .status.proceso_pago, .status.pendiente { color: #1e40af; background: #dbeafe; }
    .status.cancelado, .status.expirado { color: #991b1b; background: #fee2e2; }
    .status-detail { display: grid; justify-items: start; gap: 4px; min-width: 190px; padding: 6px 0; }
    .payment-result { color: #991b1b; font-size: .76rem; }
    .payment-reason { max-width: 260px; color: #4b5563; font-size: .72rem; line-height: 1.3; opacity: 1; }
    .payment-code { color: #6b7280; font-size: .68rem; opacity: 1; }
    .seat-list { display: grid; gap: 5px; min-width: 190px; padding: 6px 0; }
    .seat-chip { display: flex; gap: 5px; align-items: baseline; font-size: .76rem; }
    .seat-chip strong { color: var(--brand-primary); }
    .customer-phone { display: flex !important; align-items: center; gap: 4px; margin-top: 3px; }
    .customer-phone mat-icon { width: 14px; height: 14px; font-size: 14px; }
    .customer-nit { display: flex !important; align-items: center; gap: 4px; margin-top: 2px; font-weight: 700; color: var(--brand-primary); }
    .customer-nit mat-icon { width: 14px; height: 14px; font-size: 14px; }
    .muted { color: var(--text-muted); font-size: .78rem; }
    .notice, .empty { padding: 20px; border-radius: 12px; }
    .notice { display: flex; justify-content: space-between; align-items: center; }
    .notice.error { color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; }
    .empty { text-align: center; padding: 48px 20px; }
    .empty mat-icon { width: 42px; height: 42px; font-size: 42px; opacity: .45; }
    .pagination { display: flex; justify-content: flex-end; align-items: center; gap: 16px; }
    /* ── Breakpoints ── */
    @media (max-width: 1200px) { .filters { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 900px) {
      table { min-width: 0; }
      /* Hide header row */
      ::ng-deep .mat-mdc-header-row { display: none !important; }
      /* Each data row becomes a card */
      ::ng-deep .mat-mdc-row {
        display: grid !important;
        grid-template-columns: 1fr 1fr;
        gap: 0;
        border-bottom: none !important;
        border-radius: 12px;
        margin-bottom: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,.08);
        overflow: hidden;
      }
      /* Each cell: label on top, value below */
      ::ng-deep .mat-mdc-cell {
        display: flex !important;
        flex-direction: column;
        padding: 10px 14px !important;
        border-bottom: 1px solid rgba(0,0,0,.06) !important;
        min-height: unset !important;
      }
      ::ng-deep .mat-mdc-cell::before {
        content: attr(data-label);
        font-size: .68rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .04em;
        color: var(--brand-primary, #6d28d9);
        margin-bottom: 4px;
      }
      /* Reference cell spans full width and acts as card header */
      ::ng-deep .mat-column-reference {
        grid-column: 1 / -1;
        background: rgba(109,40,217,.06);
        border-bottom: 2px solid rgba(109,40,217,.18) !important;
        font-size: .85rem;
      }
      /* Actions cell spans full width */
      ::ng-deep .mat-column-actions {
        grid-column: 1 / -1;
        background: rgba(0,0,0,.02);
      }
      .status-detail { min-width: unset; }
      .seat-list { min-width: unset; }
    }
    @media (max-width: 540px) {
      ::ng-deep .mat-mdc-row { grid-template-columns: 1fr; }
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
  readonly exporting = signal(false);
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

  paymentDetail(booking: AdminBooking): { title: string; message: string; code: string } | null {
    if (!['cancelado', 'expirado'].includes(booking.status)) return null;

    const payment = this.latestPayment(booking.payments);
    if (!payment) {
      return booking.status === 'expirado'
        ? { title: 'Reserva expirada', message: 'El tiempo disponible para completar el pago terminó.', code: '' }
        : { title: 'Reserva cancelada', message: 'No se recibió el motivo del pago desde la API.', code: '' };
    }

    const response = this.paymentResponse(payment);
    const code = String(
      payment.iso_response_code ?? payment.response_code ?? response['IsoResponseCode'] ?? response['iso_response_code'] ?? ''
    ).trim();
    const rawMessage = String(
      payment.response_message ?? payment.message ?? response['ResponseMessage'] ?? response['response_message'] ?? ''
    ).trim();
    const paymentStatus = String(payment.estado_pago ?? payment.estado ?? payment.status ?? '').toLowerCase();
    const normalizedMessage = rawMessage.toLowerCase();

    if (code === '12' || normalizedMessage.includes('transaction is invalid')) {
      return {
        title: 'Pago rechazado',
        message: 'El banco o procesador indicó que la transacción es inválida. Intenta con otra tarjeta o consulta con tu banco.',
        code: code || '12'
      };
    }
    if (normalizedMessage.includes('cancel') || paymentStatus.includes('cancel')) {
      return { title: 'Pago cancelado', message: 'El proceso de pago fue cancelado antes de completarse.', code };
    }
    if (normalizedMessage.includes('3d') && (normalizedMessage.includes('fail') || normalizedMessage.includes('error'))) {
      return { title: 'Autenticación fallida', message: 'No fue posible autenticar la tarjeta mediante 3D Secure.', code };
    }
    if (normalizedMessage.includes('timeout') || normalizedMessage.includes('time out')) {
      return { title: 'Sin respuesta del banco', message: 'La entidad emisora no respondió dentro del tiempo permitido.', code };
    }
    if (['fallido', 'failed', 'rechazado', 'rejected', 'declined'].some((value) => paymentStatus.includes(value))) {
      return { title: 'Pago rechazado', message: 'El banco o procesador no autorizó la operación.', code };
    }
    if (booking.status === 'expirado') {
      return { title: 'Reserva expirada', message: 'El tiempo disponible para completar el pago terminó.', code };
    }

    return {
      title: 'Pago no completado',
      message: 'La reserva fue cancelada porque el pago no pudo completarse.',
      code
    };
  }

  private latestPayment(payments: AdminBookingPayment[] | null | undefined): AdminBookingPayment | null {
    if (!Array.isArray(payments) || payments.length === 0) return null;
    return payments.reduce((latest, current) => {
      const latestDate = Date.parse(latest.updated_at || latest.created_at || '') || 0;
      const currentDate = Date.parse(current.updated_at || current.created_at || '') || 0;
      return currentDate >= latestDate ? current : latest;
    });
  }

  private paymentResponse(payment: AdminBookingPayment): Record<string, unknown> {
    for (const candidate of [payment.callback_response, payment.gateway_response, payment.response]) {
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        return candidate as Record<string, unknown>;
      }
      if (typeof candidate === 'string') {
        try {
          const parsed: unknown = JSON.parse(candidate);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
          }
        } catch {
          // Some providers also return HTML in these fields; it has no safe status detail to display.
        }
      }
    }
    return {};
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

  customerNit(booking: AdminBooking): string {
    if (Array.isArray(booking.payments) && booking.payments.length > 0) {
      for (const payment of booking.payments) {
        if (payment?.metadata) {
          let metaObj: Record<string, unknown> | null = null;
          if (typeof payment.metadata === 'object' && payment.metadata !== null) {
            metaObj = payment.metadata as Record<string, unknown>;
          } else if (typeof payment.metadata === 'string') {
            try {
              metaObj = JSON.parse(payment.metadata) as Record<string, unknown>;
            } catch {
              metaObj = null;
            }
          }

          const nit = metaObj?.['nit'] ?? metaObj?.['NIT'];
          if (nit && typeof nit === 'string' && nit.trim() !== '') {
            return nit.trim();
          }
          if (typeof nit === 'number') {
            return String(nit);
          }
        }

        if (payment?.nit && typeof payment.nit === 'string' && payment.nit.trim() !== '') {
          return payment.nit.trim();
        }
      }
    }

    return booking.nit
      || booking.invoice_nit
      || booking.invoice?.nit
      || booking.customer?.nit
      || 'C/F';
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

  async exportExcel(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);

    // Minimal XLSX interface — the full library is loaded at runtime from CDN
    interface XLSXStatic {
      utils: {
        json_to_sheet(data: Record<string, unknown>[]): XLSXSheet;
        book_new(): XLSXWorkbook;
        book_append_sheet(wb: XLSXWorkbook, ws: XLSXSheet, name: string): void;
      };
      writeFile(wb: XLSXWorkbook, name: string): void;
    }
    interface XLSXSheet { '!cols'?: { wch: number }[]; [key: string]: unknown; }
    interface XLSXWorkbook { [key: string]: unknown; }

    try {
      const win = window as unknown as Record<string, unknown>;

      const XLSX: XLSXStatic = await new Promise<XLSXStatic>((resolve, reject) => {
        if (win['XLSX']) { resolve(win['XLSX'] as XLSXStatic); return; }
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
        script.onload = () => resolve(win['XLSX'] as XLSXStatic);
        script.onerror = reject;
        document.head.appendChild(script);
      });

      const rows: Record<string, unknown>[] = this.reservations().map((b) => {
        const seats = b.seats
          .map((s) => this.seatLabel(s) + (s.section ? ` (${s.section})` : ''))
          .join(' | ');
        return {
          'Referencia': b.reference,
          'Evento': b.event?.title ?? 'Sin evento',
          'Cliente': b.customer?.name ?? 'Invitado',
          'Correo': b.customer?.email ?? '',
          'Teléfono': this.customerPhone(b),
          'NIT': this.customerNit(b),
          'Estado': this.statusLabel(b.status),
          'Mesa / Asientos': seats,
          'Vencimiento': b.reserved_until ? new Date(b.reserved_until).toLocaleString('es-GT') : '',
          'Total (GTQ)': b.total,
          'Creada': b.created_at ? new Date(b.created_at).toLocaleString('es-GT') : '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 38 }, { wch: 22 }, { wch: 26 }, { wch: 28 }, { wch: 16 },
        { wch: 14 }, { wch: 16 }, { wch: 40 }, { wch: 20 }, { wch: 14 }, { wch: 20 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Reservas');
      XLSX.writeFile(wb, `reservas_${new Date().toISOString().slice(0, 10)}.xlsx`);

    } catch {
      this.notifications.error('No fue posible generar el archivo Excel. Intenta nuevamente.');
    } finally {
      this.exporting.set(false);
    }
  }
}
