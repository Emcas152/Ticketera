import { CommonModule, DatePipe, SlicePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';
import { CurrencyGtqPipe } from '../../shared/pipes/currency-gtq.pipe';

interface TicketRow {
  id: number | string;
  qrCode: string | null;
  status: string;
  ticketType: string | null;
  issuedAt: string | null;
  usedAt: string | null;
  eventName: string;
  eventDate: string | null;
  venueName: string;
  seatLabel: string;
  section: string;
  bookingReference: string;
  bookingTotal: number;
  pdfUrl: string | null;
  canDownload: boolean;
}

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, DatePipe, SlicePipe, CurrencyGtqPipe, ...MATERIAL_IMPORTS],
  template: `
    <section class="admin-shell">
      <div class="admin-header">
        <div class="header-titles">
          <div class="eyebrow-row">
            <span class="eyebrow">Tickets</span>
            <span class="header-count-badge">{{ tickets.length }} registros</span>
          </div>
          <h1>Tickets emitidos</h1>
        </div>
        <button mat-stroked-button (click)="load()" [disabled]="loading" class="reload-btn">
          <mat-icon>refresh</mat-icon> Recargar
        </button>
      </div>

      @if (loading) {
        <div class="loading-wrap">
          <mat-spinner diameter="36"></mat-spinner>
          <p class="loading-text">Cargando tickets…</p>
        </div>
      } @else if (error) {
        <div class="error-state">
          <mat-icon>error_outline</mat-icon>
          <p>{{ error }}</p>
        </div>
      } @else {
        <article class="panel-surface tickets-panel">
          <!-- Summary bar -->
          <div class="summary-bar">
            <div class="summary-item">
              <span class="summary-value">{{ tickets.length }}</span>
              <span class="summary-label">Total tickets</span>
            </div>
            <div class="summary-item">
              <span class="summary-value issued-count">{{ issuedCount }}</span>
              <span class="summary-label">Emitidos</span>
            </div>
            <div class="summary-item">
              <span class="summary-value used-count">{{ usedCount }}</span>
              <span class="summary-label">Usados</span>
            </div>
            <div class="summary-item">
              <span class="summary-value cancelled-count">{{ cancelledCount }}</span>
              <span class="summary-label">Cancelados</span>
            </div>
          </div>

          <div class="tkt-table-wrap">
            <table class="tkt-table">
              <thead>
                <tr>
                  <th class="col-id">#</th>
                  <th class="col-event">Evento</th>
                  <th class="col-date">Fecha</th>
                  <th class="col-booking">Reserva</th>
                  <th class="col-seat">Sección / Asiento</th>
                  <th class="col-qr">QR Code</th>
                  <th class="col-status">Estado</th>
                  <th class="col-type">Tipo</th>
                  <th class="col-total">Total</th>
                  <th class="col-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (ticket of tickets; track ticket.id; let even = $even) {
                <tr [class.row-even]="even" [class.row-used]="ticket.status === 'used' || ticket.status === 'usado'"
                    [class.row-cancelled]="ticket.status === 'cancelled' || ticket.status === 'cancelado'">
                  <td class="col-id td-id">
                    <span class="id-pill">{{ ticket.id }}</span>
                  </td>
                  <td class="col-event">
                    <div class="event-cell">
                      <span class="event-name">{{ ticket.eventName }}</span>
                      <span class="event-venue">
                        <mat-icon class="tiny-icon">place</mat-icon>{{ ticket.venueName }}
                      </span>
                    </div>
                  </td>
                  <td class="col-date td-date">
                    <span class="date-line">{{ ticket.eventDate | date: 'd MMM y' }}</span>
                    <span class="date-day">{{ ticket.eventDate | date: 'EEEE' }}</span>
                  </td>
                  <td class="col-booking td-ref">
                    <span class="ref-code" [title]="ticket.bookingReference">
                      {{ ticket.bookingReference.length > 16 ? (ticket.bookingReference | slice:0:14) + '…' : ticket.bookingReference }}
                    </span>
                  </td>
                  <td class="col-seat">
                    <div class="seat-cell">
                      <span class="seat-section">{{ ticket.section }}</span>
                      <span class="seat-label">{{ ticket.seatLabel }}</span>
                    </div>
                  </td>
                  <td class="col-qr">
                    <span class="qr-chip" [title]="ticket.qrCode ?? ''">
                      <mat-icon class="tiny-icon">qr_code</mat-icon>
                      {{ (ticket.qrCode ?? '—') | slice:0:10 }}…
                    </span>
                  </td>
                  <td class="col-status">
                    <span [class]="'tkt-badge tkt-badge--' + ticket.status">
                      <span class="badge-dot"></span>{{ statusLabel(ticket.status) }}
                    </span>
                  </td>
                  <td class="col-type td-type">
                    <span class="type-tag">{{ ticket.ticketType ?? '—' }}</span>
                  </td>
                  <td class="col-total td-total">
                    <strong class="total-amount">{{ ticket.bookingTotal | currencyGtq }}</strong>
                  </td>
                  <td class="col-actions">
                    <div class="ticket-actions">
                      <button mat-icon-button type="button" matTooltip="Enviar por correo"
                        [disabled]="isSending(ticket.id)" (click)="emailTicket(ticket)">
                        <mat-icon>{{ isSending(ticket.id) ? 'hourglass_top' : 'mail' }}</mat-icon>
                      </button>
                      <button mat-icon-button type="button" matTooltip="Descargar ticket"
                        [disabled]="!ticket.canDownload || !ticket.pdfUrl" (click)="downloadTicket(ticket)">
                        <mat-icon>download</mat-icon>
                      </button>
                    </div>
                  </td>
                </tr>
                } @empty {
                <tr>
                  <td colspan="10" class="empty-row">
                    <mat-icon>confirmation_number</mat-icon>
                    <p>No se encontraron tickets.</p>
                  </td>
                </tr>
                }
              </tbody>
            </table>
          </div>
        </article>
      }
    </section>
  `,
  styles: [`
    /* ── Header ───────────────────────────────── */
    .admin-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .eyebrow-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 2px;
    }
    .eyebrow {
      margin: 0;
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--brand-secondary);
    }
    .header-count-badge {
      font-size: 0.68rem;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 999px;
      background: rgba(106, 0, 255, 0.1);
      color: var(--brand-primary);
    }
    .admin-header h1 {
      font-size: 1.35rem;
      margin: 0;
    }

    /* ── Loading / Error ──────────────────────── */
    .loading-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 32px;
    }
    .loading-text {
      color: var(--text-muted);
      font-size: .84rem;
      font-weight: 600;
      margin: 0;
    }
    .error-state {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 20px;
      background: #fff1f1;
      border: 1px solid #fecaca;
      border-radius: 10px;
      color: #991b1b;
      font-weight: 600;
    }

    /* ── Panel ────────────────────────────────── */
    .tickets-panel {
      padding: 0;
      overflow: hidden;
    }

    /* ── Summary bar ──────────────────────────── */
    .summary-bar {
      display: flex;
      gap: 0;
      background: #faf8fc;
      border-bottom: 1px solid var(--surface-border);
    }
    .summary-item {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 12px;
      border-right: 1px solid var(--surface-border);
    }
    .summary-item:last-child { border-right: none; }
    .summary-value {
      font-size: 1.15rem;
      font-weight: 800;
      font-family: 'Eurostile Extended', 'Montserrat', sans-serif;
      color: var(--text-primary);
      line-height: 1;
    }
    .summary-label {
      font-size: .66rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: var(--text-muted);
    }
    .issued-count  { color: #059669; }
    .used-count    { color: #d97706; }
    .cancelled-count { color: #dc2626; }

    /* ── Table wrapper ────────────────────────── */
    .tkt-table-wrap {
      overflow-x: auto;
      overflow-y: visible;
    }

    /* ── Table ────────────────────────────────── */
    .tkt-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: auto;
    }

    /* ── Header ───────────────────────────────── */
    .tkt-table thead tr {
      background: linear-gradient(110deg, #1a0033 0%, #2d006b 55%, #55003a 100%);
    }
    .tkt-table th {
      padding: 9px 12px;
      text-align: left;
      font-size: .66rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: rgba(255,255,255,.8);
      white-space: nowrap;
    }

    /* ── Rows ─────────────────────────────────── */
    .tkt-table tbody tr {
      border-bottom: 1px solid var(--surface-border);
      transition: background .12s, box-shadow .12s;
    }
    .tkt-table tbody tr:hover {
      background: rgba(106,0,255,.04);
      box-shadow: inset 3px 0 0 var(--brand-primary);
    }
    .tkt-table tbody tr:last-child { border-bottom: none; }
    .row-even { background: rgba(106,0,255,.012); }
    .row-used { background: rgba(255,193,7,.03); }
    .row-cancelled { background: rgba(220,38,38,.03); }

    .tkt-table td {
      padding: 8px 12px;
      vertical-align: middle;
      white-space: nowrap;
    }

    /* ── ID pill ──────────────────────────────── */
    .id-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 22px;
      padding: 0 6px;
      background: var(--brand-gradient-soft);
      border: 1px solid rgba(106,0,255,.16);
      border-radius: 5px;
      font-size: .72rem;
      font-weight: 800;
      color: var(--brand-primary);
    }

    /* ── Event cell ───────────────────────────── */
    .event-cell {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .event-name {
      font-weight: 700;
      font-size: .84rem;
      color: var(--text-primary);
    }
    .event-venue {
      display: flex;
      align-items: center;
      gap: 2px;
      font-size: .72rem;
      color: var(--text-muted);
    }

    /* ── Date cell ────────────────────────────── */
    .date-line {
      display: block;
      font-weight: 700;
      font-size: .8rem;
    }
    .date-day {
      display: block;
      font-size: .68rem;
      color: var(--text-muted);
      text-transform: capitalize;
    }

    /* ── Reference ────────────────────────────── */
    .ref-code {
      display: inline-block;
      font-family: 'Courier New', monospace;
      font-size: .7rem;
      font-weight: 700;
      color: var(--brand-primary);
      background: rgba(106,0,255,.06);
      padding: 2px 6px;
      border-radius: 5px;
      border: 1px solid rgba(106,0,255,.14);
      cursor: help;
    }

    /* ── Seat cell ────────────────────────────── */
    .seat-cell {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .seat-section {
      font-weight: 700;
      font-size: .82rem;
      color: var(--brand-secondary);
    }
    .seat-label {
      font-size: .7rem;
      color: var(--text-muted);
    }

    /* ── QR chip ──────────────────────────────── */
    .qr-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-family: 'Courier New', monospace;
      font-size: .68rem;
      color: var(--text-muted);
      background: #f3f0f7;
      padding: 2px 6px;
      border-radius: 5px;
      cursor: help;
    }

    /* ── Status badges ────────────────────────── */
    .tkt-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 9px 3px 7px;
      border-radius: 999px;
      font-size: .72rem;
      font-weight: 700;
    }
    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* Emitido / issued */
    .tkt-badge--issued,
    .tkt-badge--emitido {
      background: rgba(5,150,105,.12);
      color: #065f46;
    }
    .tkt-badge--issued .badge-dot,
    .tkt-badge--emitido .badge-dot {
      background: #059669;
    }

    /* Usado / used */
    .tkt-badge--used,
    .tkt-badge--usado {
      background: rgba(217,119,6,.12);
      color: #92400e;
    }
    .tkt-badge--used .badge-dot,
    .tkt-badge--usado .badge-dot {
      background: #d97706;
    }

    /* Cancelado / cancelled */
    .tkt-badge--cancelled,
    .tkt-badge--cancelado {
      background: rgba(220,38,38,.1);
      color: #991b1b;
    }
    .tkt-badge--cancelled .badge-dot,
    .tkt-badge--cancelado .badge-dot {
      background: #dc2626;
    }

    /* ── Type tag ─────────────────────────────── */
    .type-tag {
      font-size: .72rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: capitalize;
    }

    /* ── Total ────────────────────────────────── */
    .total-amount {
      font-size: .88rem;
      font-weight: 800;
      background: var(--brand-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .ticket-actions { display:flex;align-items:center;gap:2px; }
    .ticket-actions button { width:32px;height:32px;color:var(--brand-primary); }
    .ticket-actions mat-icon { font-size:18px;width:18px;height:18px; }

    /* ── Empty row ────────────────────────────── */
    .empty-row {
      text-align: center;
      padding: 48px 24px !important;
      color: var(--text-muted);
    }
    .empty-row mat-icon {
      font-size: 2.5rem;
      width: 2.5rem;
      height: 2.5rem;
      opacity: .35;
    }
    .empty-row p { margin: 8px 0 0; font-size: .9rem; }

    /* ── Tiny icons ───────────────────────────── */
    .tiny-icon {
      font-size: .9rem;
      width: .9rem;
      height: .9rem;
      line-height: 1;
      vertical-align: middle;
    }

    /* ── Reload button ────────────────────────── */
    .reload-btn {
      transition: transform .15s;
    }
    .reload-btn:hover mat-icon {
      animation: spin .5s linear;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
  `]
})
export class TicketsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly snackBar = inject(MatSnackBar);

  tickets: TicketRow[] = [];
  loading = false;
  error: string | null = null;
  readonly sendingTicketIds = new Set<string>();

  get issuedCount(): number {
    return this.tickets.filter(t => t.status === 'issued' || t.status === 'emitido').length;
  }
  get usedCount(): number {
    return this.tickets.filter(t => t.status === 'used' || t.status === 'usado').length;
  }
  get cancelledCount(): number {
    return this.tickets.filter(t => t.status === 'cancelled' || t.status === 'cancelado').length;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.api.get<any[]>('/tickets', { per_page: 200 }).subscribe({
      next: (data) => {
        this.tickets = (Array.isArray(data) ? data : []).map((t) => this.mapTicket(t));
        this.loading = false;
      },
      error: () => {
        this.error = 'Error al cargar los tickets. Intenta de nuevo.';
        this.loading = false;
      }
    });
  }

  private mapTicket(t: any): TicketRow {
    const seat = t.seat;
    const seatLabel = seat?.label ??
      (seat?.number_table
        ? `Mesa ${seat.number_table} · Asiento ${seat.number ?? 'sin número'}`
        : seat?.row
          ? `Fila ${seat.row} · Asiento ${seat.number ?? 'sin número'}`
          : seat?.number
            ? `Asiento ${seat.number}`
            : 'Sin asiento asignado');

    return {
      id: t.id,
      qrCode: t.qr_code ?? null,
      status: t.status ?? 'issued',
      ticketType: t.ticket_type ?? null,
      issuedAt: t.issued_at ?? null,
      usedAt: t.used_at ?? null,
      eventName: t.event?.title ?? '—',
      eventDate: t.event?.starts_at ?? null,
      venueName: t.event?.venue ?? '—',
      seatLabel,
      section: seat?.section ?? '—',
      bookingReference: t.booking?.reference ?? t.booking_reference ?? '—',
      bookingTotal: Number(t.ticket_total ?? t.booking?.total ?? 0),
      pdfUrl: t.pdf_url ?? null,
      canDownload: Boolean(t.can_download),
    };
  }

  isSending(ticketId: number | string): boolean {
    return this.sendingTicketIds.has(String(ticketId));
  }

  emailTicket(ticket: TicketRow): void {
    const id = String(ticket.id);
    if (this.sendingTicketIds.has(id)) return;
    this.sendingTicketIds.add(id);
    this.api.post<{ message?: string }>(`/tickets/${ticket.id}/email`, {}).subscribe({
      next: (response) => {
        this.sendingTicketIds.delete(id);
        this.snackBar.open(response?.message || 'Ticket enviado por correo.', 'OK', { duration: 3500 });
      },
      error: () => {
        this.sendingTicketIds.delete(id);
        this.snackBar.open('No fue posible enviar el ticket por correo.', 'OK', { duration: 4500 });
      }
    });
  }

  downloadTicket(ticket: TicketRow): void {
    if (!ticket.pdfUrl || !ticket.canDownload) return;
    window.open(ticket.pdfUrl, '_blank', 'noopener,noreferrer');
  }

  statusLabel(status: string): string {
    const normalized = String(status).toLowerCase();
    const labels: Record<string, string> = {
      issued: 'Emitido',
      emitido: 'Emitido',
      used: 'Usado',
      usado: 'Usado',
      cancelled: 'Cancelado',
      cancelado: 'Cancelado',
    };
    return labels[normalized] ?? status;
  }
}
