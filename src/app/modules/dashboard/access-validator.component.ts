import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BookingRecord } from '../../core/models/booking.model';
import { BookingService, TicketValidationResult } from '../../core/services/booking.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

@Component({
  selector: 'app-access-validator',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, ...MATERIAL_IMPORTS],
  template: `
    <section class="admin-shell">
      <div class="admin-header">
        <div>
          <p class="eyebrow">Control de acceso</p>
          <h1>Validar QR</h1>
          <p class="admin-subtitle">Lectura interna para autorizar entrada y bloquear copias del mismo ticket.</p>
        </div>
      </div>

      <article class="validator-grid">
        <form class="panel-surface validator-panel" (ngSubmit)="validate()">
          <mat-form-field appearance="outline">
            <mat-label>Payload del QR</mat-label>
            <textarea
              matInput
              name="qrPayload"
              rows="5"
              [(ngModel)]="qrPayload"
              placeholder="ALCON-TICKET:v1:..."
              autocomplete="off"
            ></textarea>
          </mat-form-field>

          <div class="validator-actions">
            <button mat-flat-button color="primary" type="submit">
              <mat-icon>qr_code_scanner</mat-icon>
              Validar acceso
            </button>
            <button mat-stroked-button type="button" (click)="clear()">
              <mat-icon>backspace</mat-icon>
              Limpiar
            </button>
          </div>
        </form>

        <article class="panel-surface result-panel" [ngClass]="result?.status || 'idle'">
          <mat-icon class="result-icon">{{ iconName }}</mat-icon>
          <p class="result-label">{{ resultLabel }}</p>
          <h2>{{ result?.message || 'Esperando lectura de QR.' }}</h2>

          <div *ngIf="result?.booking as booking" class="ticket-summary">
            <p><span>Orden</span><strong>{{ booking.orderNumber }}</strong></p>
            <p><span>Evento</span><strong>{{ booking.eventName }}</strong></p>
            <p><span>Fecha</span><strong>{{ booking.eventDate | date: 'EEEE, d MMM y, h:mm a' }}</strong></p>
            <p><span>Asientos</span><strong>{{ seatLabels(booking) }}</strong></p>
            <p *ngIf="booking.usedAt"><span>Usado</span><strong>{{ booking.usedAt | date: 'd MMM y, h:mm a' }}</strong></p>
          </div>
        </article>
      </article>
    </section>
  `,
  styles: [
    `
      .validator-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(320px, 0.8fr);
        gap: 18px;
      }

      .validator-panel,
      .result-panel {
        padding: 22px;
      }

      mat-form-field {
        width: 100%;
      }

      textarea {
        font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
      }

      .validator-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .result-panel {
        border-left: 6px solid #94a3b8;
      }

      .result-panel.valid {
        border-left-color: #15803d;
      }

      .result-panel.used,
      .result-panel.invalid {
        border-left-color: #b91c1c;
      }

      .result-panel.unknown {
        border-left-color: #b45309;
      }

      .result-icon {
        width: 52px;
        height: 52px;
        font-size: 52px;
        color: #334155;
      }

      .valid .result-icon {
        color: #15803d;
      }

      .used .result-icon,
      .invalid .result-icon {
        color: #b91c1c;
      }

      .unknown .result-icon {
        color: #b45309;
      }

      .result-label {
        margin: 16px 0 4px;
        color: #64748b;
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .result-panel h2 {
        margin: 0;
        color: #0f172a;
        font-size: 1.35rem;
        line-height: 1.3;
      }

      .ticket-summary {
        display: grid;
        gap: 10px;
        margin-top: 20px;
      }

      .ticket-summary p {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        margin: 0;
        border-top: 1px solid #e2e8f0;
        padding-top: 10px;
      }

      .ticket-summary span {
        color: #64748b;
      }

      .ticket-summary strong {
        color: #0f172a;
        text-align: right;
      }

      @media (max-width: 900px) {
        .validator-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class AccessValidatorComponent {
  private readonly booking = inject(BookingService);
  qrPayload = '';
  result: TicketValidationResult | null = null;

  get iconName(): string {
    if (this.result?.status === 'valid') return 'check_circle';
    if (this.result?.status === 'used') return 'block';
    if (this.result?.status === 'invalid') return 'error';
    if (this.result?.status === 'unknown') return 'help';
    return 'qr_code_scanner';
  }

  get resultLabel(): string {
    if (this.result?.status === 'valid') return 'Autorizado';
    if (this.result?.status === 'used') return 'Copia o reintento';
    if (this.result?.status === 'invalid') return 'Rechazado';
    if (this.result?.status === 'unknown') return 'No registrado';
    return 'Sin lectura';
  }

  validate(): void {
    this.result = this.booking.validateTicketQr(this.qrPayload);
  }

  clear(): void {
    this.qrPayload = '';
    this.result = null;
  }

  seatLabels(booking: BookingRecord): string {
    return booking.seats.map((seat) => seat.label).join(', ');
  }
}
