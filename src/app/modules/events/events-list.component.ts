import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { EventFilters } from '../../core/models/event.model';
import { EventService } from '../../core/services/event.service';
import { EventCardComponent } from '../../shared/components/event-card/event-card.component';
import { EventFiltersComponent } from '../../shared/components/event-filters/event-filters.component';

@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [CommonModule, AsyncPipe, EventCardComponent, EventFiltersComponent],
  template: `
    <section class="page-shell section-header">
      <div>
        <p class="eyebrow">Catalog</p>
        <h1>Listado de eventos</h1>
        <p class="section-copy">Filtra por categoria, ciudad, rango de precio o ventana temporal.</p>
      </div>
    </section>

    <section class="page-shell">
      <app-event-filters
        [categories]="categories"
        [cities]="cities"
        [filters]="filters"
        (filtersChange)="onFiltersChange($event)"
      />
    </section>

    <section class="page-shell results-shell">
      <p class="results-count">{{ (events$ | async)?.length ?? 0 }} resultados</p>

      <div class="grid">
        <app-event-card *ngFor="let event of events$ | async" [event]="event" />
      </div>
    </section>
  `,
  styles: [
    `
      .section-header {
        padding-top: 24px;
      }

      .section-copy,
      .results-count {
        color: var(--text-muted);
      }

      .results-shell {
        padding-top: 24px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 20px;
      }

      @media (max-width: 1100px) {
        .grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 768px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class EventsListComponent {
  private readonly eventService = inject(EventService);
  filters = this.eventService.getDefaultFilters();
  categories = this.eventService.getCategories();
  cities = this.eventService.getCities();
  events$ = this.eventService.getEvents(this.filters);

  onFiltersChange(filters: EventFilters): void {
    this.filters = filters;
    this.events$ = this.eventService.getEvents(filters);
  }
}
