import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EventItem } from '../../core/models/event.model';
import { EventService } from '../../core/services/event.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

@Component({
  selector: 'app-event-history',
  standalone: true,
  imports: [CommonModule, RouterLink, ...MATERIAL_IMPORTS],
  template: `
    <section class="panel-surface history">
      <div>
        <h1>Eventos anteriores</h1>
        <p>Consulta los eventos finalizados y archivados, sus ingresos, entradas vendidas y métodos de pago.</p>
      </div>
      <mat-form-field appearance="outline">
        <mat-label>Buscar por evento o ubicación</mat-label>
        <input matInput (input)="query = $any($event.target).value" />
      </mat-form-field>
      @if (loading) {
        <p role="status">Cargando historial...</p>
      } @else if (error) {
        <p role="alert">No se pudo cargar el historial.</p>
        <button mat-stroked-button (click)="load()">Reintentar</button>
      } @else {
        <p>{{ filteredEvents.length }} eventos</p>
        @for (event of filteredEvents; track event.id) {
          <article class="history-row">
            <div>
              <h2>{{ event.name }}</h2>
              <p>{{ event.date | date: 'dd/MM/yyyy' : '-0600' }} · {{ event.venueName }}</p>
              <span>{{ event.archived ? 'Archivado' : 'Finalizado' }}</span>
            </div>
            <a mat-stroked-button routerLink="/dashboard" [queryParams]="{ eventId: event.id }">
              <mat-icon>bar_chart</mat-icon> Ver ventas e información
            </a>
          </article>
        } @empty {
          <p>{{ query ? 'No hay eventos que coincidan con la búsqueda.' : 'Todavía no hay eventos finalizados ni archivados.' }}</p>
        }
      }
    </section>
  `,
  styles: [`
    .history { display: grid; gap: 20px; padding: 24px; }
    h1, h2 { margin: 0; } h2 { font-size: 1.1rem; }
    p { color: var(--text-muted); }
    .history-row { display: flex; align-items: center; justify-content: space-between; gap: 20px;
      padding: 20px 0; border-top: 1px solid var(--surface-border); }
    .history-row span { font-size: .85rem; }
    @media (max-width: 640px) { .history-row { align-items: flex-start; flex-direction: column; } }
  `]
})
export class EventHistoryComponent {
  private readonly service = inject(EventService);
  events: EventItem[] = [];
  query = '';
  loading = true;
  error = false;

  constructor() { this.load(); }

  get filteredEvents(): EventItem[] {
    const query = this.query.trim().toLocaleLowerCase('es');
    return this.events.filter((event) => `${event.name} ${event.venueName}`.toLocaleLowerCase('es').includes(query));
  }

  load(): void {
    this.loading = true;
    this.error = false;
    this.service.getAdminEvents().subscribe({
      next: (events) => {
        this.events = events.filter((event) => this.service.isHistorical(event))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        this.loading = false;
      },
      error: () => { this.error = true; this.loading = false; }
    });
  }
}
