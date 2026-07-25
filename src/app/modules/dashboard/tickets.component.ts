import { CommonModule, DatePipe } from '@angular/common';
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
}

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, DatePipe, CurrencyGtqPipe, ...MATERIAL_IMPORTS],
  template: `
    <section class="admin-shell">
      <div class="admin-header">
        <div>
          <p class="eyebrow">Tickets</p>
          <h1>Tickets emitidos</h1>
          <p class="admin-subtitle">Listado de tickets de la base de datos.</p>
        </div>
        <button mat-stroked-button (click)="load()" [disabled]="loading">
          <mat-icon>refresh</mat-icon> Recargar
        </button>
      </div>

      @if (loading) {
        <div style="display:flex;justify-content:center;padding:32px">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (error) {
        <div class="panel-surface" style="padding:20px;color:#ef4444">{{ error }}</div>
      } @else {
        <article class="panel-surface">
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Evento</th>
                  <th>Fecha</th>
                  <th>Reserva</th>
                  <th>Sección / Asiento</th>
                  <th>QR Code</th>
                  <th>Estado</th>
                  <th>Tipo</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                @for (ticket of tickets; track ticket.id) {
                <tr>
                  <td>{{ ticket.id }}</td>
                  <td>
                    <strong>{{ ticket.eventName }}</strong>
                    <p>{{ ticket.venueName }}</p>
                  </td>
                  <td>{{ ticket.eventDate | date: 'EEEE, d MMM y' }}</td>
                  <td>{{ ticket.bookingReference }}</td>
                  <td>
                    <strong>{{ ticket.section }}</strong>
                    <p>{{ ticket.seatLabel }}</p>
                  </td>
                  <td style="font-size:.75rem;word-break:break-all;max-width:160px">{{ ticket.qrCode }}</td>
                  <td>
                    <span [class]="'status-badge status-' + ticket.status">{{ statusLabel(ticket.status) }}</span>
                  </td>
                  <td>{{ ticket.ticketType ?? '—' }}</td>
                  <td><strong>{{ ticket.bookingTotal | currencyGtq }}</strong></td>
                </tr>
                } @empty {
                <tr>
                  <td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted)">
                    No se encontraron tickets.
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
    .status-badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:.75rem;font-weight:700}
    .status-issued, .status-emitido{background:#d1fae5;color:#065f46}
    .status-used, .status-usado{background:#fef3c7;color:#92400e}
    .status-cancelled, .status-cancelado{background:#fee2e2;color:#991b1b}
    p{margin:2px 0;color:var(--text-muted);font-size:.82rem}
  `]
})
export class TicketsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly snackBar = inject(MatSnackBar);

  tickets: TicketRow[] = [];
  loading = false;
  error: string | null = null;

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
      error: (err) => {
        console.error('Error loading tickets', err);
        this.error = 'Error al cargar los tickets. Intenta de nuevo.';
        this.loading = false;
      }
    });
  }

  private mapTicket(t: any): TicketRow {
    const seat = t.seat;
    const seatLabel = seat
      ? `Mesa ${seat.number_table ?? '?'} - Asiento ${seat.seat_number ?? '?'}`
      : '—';

    return {
      id: t.id,
      qrCode: t.qr_code ?? null,
      status: t.status ?? 'issued',
      ticketType: t.ticket_type ?? null,
      issuedAt: t.issued_at ?? null,
      usedAt: t.used_at ?? null,
      eventName: t.event?.title ?? '—',
      eventDate: t.event?.starts_at ?? null,
      venueName: t.venue?.name ?? '—',
      seatLabel,
      section: seat?.section ?? '—',
      bookingReference: t.booking?.reference ?? '—',
      bookingTotal: t.booking?.total ?? 0,
    };
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
