import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { CourtesyLimit, CourtesyLimitService } from '../../core/services/courtesy-limit.service';
import { EventService } from '../../core/services/event.service';
import { NotificationService } from '../../core/services/notification.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';
import { CashSalesComponent } from './cash-sales.component';

@Component({
  selector: 'app-courtesy-seats',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CashSalesComponent, ...MATERIAL_IMPORTS],
  template: `
    <section class="limit-panel panel-surface">
      <div class="limit-heading">
        <div><p class="eyebrow">Control de cupo</p><h2>Cortesías por evento</h2>
          <p>Consulta las cortesías asignadas al evento y ajusta el máximo permitido.</p></div>
      </div>

      <form [formGroup]="form" (ngSubmit)="save()" class="limit-form">
        <mat-form-field appearance="outline"><mat-label>Evento</mat-label>
          <mat-select formControlName="eventId" (selectionChange)="loadLimit()">
            @for (event of events; track event.id) { <mat-option [value]="event.id">{{ event.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Máximo de cortesías</mat-label>
          <input matInput type="number" min="0" step="1" formControlName="maximum" />
          @if (form.controls.maximum.hasError('min')) { <mat-error>El máximo no puede ser negativo.</mat-error> }
        </mat-form-field>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || loading || saving">
          <mat-icon>save</mat-icon>{{ saving ? 'Guardando...' : (limit?.id ? 'Actualizar cupo' : 'Asignar cupo') }}
        </button>
      </form>

      @if (loading) { <div class="loading"><mat-spinner diameter="28" /> Consultando cupo...</div> }
      @if (!loading && limit) {
        <div class="metrics">
          <article><span>Permitidas</span><strong>{{ limit.maximum }}</strong></article>
          <article><span>Utilizadas</span><strong>{{ limit.used }}</strong></article>
          <article class="available"><span>Disponibles</span><strong>{{ limit.available }}</strong></article>
        </div>
        @if (form.controls.maximum.value < limit.used) {
          <p class="warning">El máximo no puede ser menor que las {{ limit.used }} cortesías ya utilizadas.</p>
        }
      }
    </section>
    <app-cash-sales mode="courtesy" />
  `,
  styles: [`
    .limit-panel{padding:22px;margin-bottom:20px}.limit-heading h2{margin:3px 0}.limit-heading p:last-child{margin:0;color:var(--text-muted)}
    .limit-form{display:grid;grid-template-columns:minmax(240px,2fr) minmax(190px,1fr) auto;gap:14px;align-items:center;margin-top:20px}.limit-form mat-form-field{width:100%}
    .metrics{display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:12px}.metrics article{display:grid;gap:4px;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}.metrics span{color:var(--text-muted);font-size:.78rem;font-weight:700}.metrics strong{font-size:1.65rem}.metrics .available{background:#ecfdf5;border-color:#a7f3d0}.metrics .available strong{color:#047857}
    .loading{display:flex;align-items:center;gap:10px;color:var(--text-muted)}.warning{padding:10px 14px;border-radius:10px;background:#fff7ed;color:#9a3412}
    @media(max-width:760px){.limit-form,.metrics{grid-template-columns:1fr}}
  `]
})
export class CourtesySeatsComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly eventService = inject(EventService);
  private readonly limits = inject(CourtesyLimitService);
  private readonly notifications = inject(NotificationService);

  readonly form = this.fb.group({ eventId: ['', Validators.required], maximum: [0, [Validators.required, Validators.min(0)]] });
  events: Array<{ id: string; name: string }> = [];
  limit: CourtesyLimit | null = null;
  loading = false;
  saving = false;

  constructor() {
    this.eventService.getEvents().subscribe((events) => this.events = events.map(({ id, name }) => ({ id, name })));
  }

  loadLimit(): void {
    const eventId = this.form.controls.eventId.value;
    if (!eventId) return;
    this.loading = true;
    this.limit = null;
    this.limits.getByEvent(eventId).pipe(finalize(() => this.loading = false)).subscribe({
      next: (limit) => { this.limit = limit; this.form.controls.maximum.setValue(limit.maximum); },
      error: (error: { status?: number }) => {
        if (error.status === 404) this.limit = { eventId, maximum: 0, used: 0, available: 0 };
      }
    });
  }

  save(): void {
    if (this.form.invalid || this.saving) return;
    const { eventId, maximum } = this.form.getRawValue();
    if (this.limit && maximum < this.limit.used) {
      this.notifications.error(`El máximo no puede ser menor que las ${this.limit.used} cortesías utilizadas.`);
      return;
    }
    this.saving = true;
    this.limits.save(eventId, maximum, this.limit?.id).pipe(finalize(() => this.saving = false)).subscribe((limit) => {
      this.limit = limit;
      this.form.controls.maximum.setValue(limit.maximum);
      this.notifications.success('Cupo de cortesías guardado correctamente.');
    });
  }
}
