import { inject, Injectable } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MOCK_EVENTS } from '../mocks/mock-data';
import { EventFilters, EventItem } from '../models/event.model';
import { ApiService } from './api.service';

const DEFAULT_FILTERS: EventFilters = {
  query: '',
  category: 'all',
  city: 'all',
  datePreset: 'all',
  priceRange: 'all'
};

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly api = inject(ApiService);

  getDefaultFilters(): EventFilters {
    return { ...DEFAULT_FILTERS };
  }

  getEvents(filters: EventFilters = DEFAULT_FILTERS): Observable<EventItem[]> {
    if (environment.useMocks) {
      return of(this.applyFilters(MOCK_EVENTS, filters)).pipe(delay(250));
    }

    return this.api.get<EventItem[], EventFilters>('/events', filters);
  }

  getFeaturedEvents(): Observable<EventItem[]> {
    if (environment.useMocks) {
      return of(MOCK_EVENTS.filter((event) => event.featured)).pipe(delay(150));
    }

    return this.api.get<EventItem[]>('/events/featured');
  }

  getEventById(eventId: string): Observable<EventItem | undefined> {
    if (environment.useMocks) {
      return of(MOCK_EVENTS.find((event) => event.id === eventId)).pipe(delay(200));
    }

    return this.api.get<EventItem>(`/events/${eventId}`).pipe(map((event) => event ?? undefined));
  }

  getCategories(): string[] {
    return ['all', ...new Set(MOCK_EVENTS.map((event) => event.category))];
  }

  getCities(): string[] {
    return ['all', ...new Set(MOCK_EVENTS.map((event) => event.city))];
  }

  private applyFilters(events: EventItem[], filters: EventFilters): EventItem[] {
    return events.filter((event) => {
      const searchMatch =
        !filters.query ||
        `${event.name} ${event.location} ${event.category}`.toLowerCase().includes(filters.query.toLowerCase());
      const categoryMatch = filters.category === 'all' || event.category === filters.category;
      const cityMatch = filters.city === 'all' || event.city === filters.city;
      const priceMatch =
        filters.priceRange === 'all' ||
        (filters.priceRange === 'budget' && event.basePrice <= 200) ||
        (filters.priceRange === 'premium' && event.basePrice > 200);
      const dateMatch = this.matchDate(event.date, filters.datePreset);

      return searchMatch && categoryMatch && cityMatch && priceMatch && dateMatch;
    });
  }

  private matchDate(date: string, preset: EventFilters['datePreset']): boolean {
    if (preset === 'all') {
      return true;
    }

    const eventDate = new Date(date);
    const now = new Date();
    const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (preset === 'today') {
      return diffDays <= 1;
    }

    if (preset === 'week') {
      return diffDays <= 7;
    }

    return diffDays <= 30;
  }
}
