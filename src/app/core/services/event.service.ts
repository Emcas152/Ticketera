import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, delay, map, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MOCK_EVENTS } from '../mocks/mock-data';
import { EventFilters, EventItem, EventPriceTier } from '../models/event.model';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';

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
  private readonly storage = inject(StorageService);
  private readonly eventsKey = 'pulse-admin-events';
  private readonly eventsSubject = new BehaviorSubject<EventItem[]>(
    this.storage.getItem<EventItem[]>(this.eventsKey, MOCK_EVENTS)
  );

  readonly events$ = this.eventsSubject.asObservable();

  getDefaultFilters(): EventFilters {
    return { ...DEFAULT_FILTERS };
  }

  getEvents(filters: EventFilters = DEFAULT_FILTERS): Observable<EventItem[]> {
    if (environment.useMocks) {
      return this.events$.pipe(map((events) => this.applyFilters(events, filters)), delay(250));
    }

    return this.api.get<LaravelEventListResponse, { per_page: number }>('/events', { per_page: 100 }).pipe(
      map((response) => this.extractLaravelEvents(response).map((event) => this.mapLaravelEvent(event))),
      map((events) => this.applyFilters(events, filters)),
      tap((events) => this.eventsSubject.next(events))
    );
  }

  getFeaturedEvents(): Observable<EventItem[]> {
    if (environment.useMocks) {
      return this.events$.pipe(
        map((events) => events.filter((event) => event.featured || event.status !== 'draft')),
        delay(150)
      );
    }

    return this.getEvents().pipe(map((events) => events.filter((event) => event.featured || event.status !== 'draft')));
  }

  getEventById(eventId: string): Observable<EventItem | undefined> {
    if (environment.useMocks) {
      return this.events$.pipe(map((events) => events.find((event) => event.id === eventId)), delay(200));
    }

    return this.api.get<LaravelEvent>(`/events/${eventId}`).pipe(map((event) => this.mapLaravelEvent(event)));
  }

  getCategories(): string[] {
    return ['all', ...new Set(this.eventsSubject.value.map((event) => event.category))];
  }

  getCities(): string[] {
    return ['all', ...new Set(this.eventsSubject.value.map((event) => event.city))];
  }

  createEvent(input: EventAdminInput): Observable<EventItem> {
    const event = this.mapAdminInputToEvent(input);

    if (!environment.useMocks) {
      return this.api
        .post<LaravelEvent>('/events', this.mapAdminInputToFormData(input))
        .pipe(
          switchMap((created) => this.saveSectionPrices(created, input)),
          map((created) => this.mapLaravelEvent(created)),
          tap((created) => this.eventsSubject.next([created, ...this.eventsSubject.value]))
        );
    }

    return of(event).pipe(
      delay(250),
      tap((created) => this.persistEvents([created, ...this.eventsSubject.value]))
    );
  }

  updateEvent(eventId: string, input: EventAdminInput): Observable<EventItem> {
    const event = this.mapAdminInputToEvent(input, eventId);

    if (!environment.useMocks) {
      return this.api
        .post<LaravelEvent>(`/events/${eventId}`, this.mapAdminInputToFormData(input, true))
        .pipe(
          switchMap((updated) => this.saveSectionPrices(updated, input)),
          map((updated) => this.mapLaravelEvent(updated)),
          tap((updated) => this.eventsSubject.next(
            this.eventsSubject.value.map((item) => item.id === eventId ? updated : item)
          ))
        );
    }

    return of(event).pipe(
      delay(250),
      tap((updated) =>
        this.persistEvents(this.eventsSubject.value.map((item) => (item.id === eventId ? updated : item)))
      )
    );
  }

  deleteEvent(eventId: string): Observable<void> {
    if (!environment.useMocks) {
      return this.api.delete<null>(`/events/${eventId}`).pipe(
        tap(() => this.eventsSubject.next(this.eventsSubject.value.filter((event) => event.id !== eventId))),
        map(() => undefined)
      );
    }

    return of(undefined).pipe(
      delay(200),
      tap(() => this.persistEvents(this.eventsSubject.value.filter((event) => event.id !== eventId)))
    );
  }

  publishEvent(eventId: string): Observable<EventItem | undefined> {
    const event = this.eventsSubject.value.find((item) => item.id === eventId);
    const updated = event ? { ...event, featured: true, status: 'on-sale' as const } : undefined;

    if (!environment.useMocks) {
      return this.api
        .put<LaravelEvent>(`/events/${eventId}`, { status: 'publicado' })
        .pipe(
          map((published) => this.mapLaravelEvent(published)),
          tap((published) => this.eventsSubject.next(
            this.eventsSubject.value.map((item) => item.id === eventId ? published : item)
          ))
        );
    }

    return of(updated).pipe(
      delay(200),
      tap((published) => {
        if (!published) return;
        this.persistEvents(this.eventsSubject.value.map((item) => (item.id === eventId ? published : item)));
      })
    );
  }

  private persistEvents(events: EventItem[]): void {
    this.eventsSubject.next(events);
    this.storage.setItem(this.eventsKey, events);
  }

  private mapAdminInputToEvent(input: EventAdminInput, eventId?: string): EventItem {
    const id = eventId ?? `evt-${this.slugify(input.name)}-${Date.now().toString().slice(-5)}`;
    const priceTiers = input.priceTiers.length > 0 ? input.priceTiers : this.defaultPriceTiers(input.basePrice);

    return {
      id,
      slug: this.slugify(input.name),
      name: input.name,
      category: input.category,
      city: input.city,
      date: this.toEventIso(input.date, input.time),
      time: input.time,
      location: input.location,
      venueName: input.venueName,
      address: input.address,
      image: input.image || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80',
      pdfImage: input.image,
      bannerColor: input.bannerColor || '#6a00ff',
      basePrice: input.basePrice,
      description: input.description,
      shortDescription: input.shortDescription || input.description.slice(0, 120),
      featured: input.status !== 'draft',
      status: input.status,
      tags: input.tags,
      metrics: {
        interested: input.interested,
        ticketsLeft: input.capacity,
        rating: 4.7
      },
      priceTiers
    };
  }

  private mapAdminInputToLaravel(input: EventAdminInput): LaravelEventInput {
    const startsAt = this.toEventIso(input.date, input.time);

    return {
      venue_id: Number(input.venueId),
      title: input.name,
      description: input.description,
      category: input.category,
      base_price: input.basePrice,
      capacity: input.capacity,
      image_url: input.image || null,
      starts_at: startsAt,
      ends_at: new Date(new Date(startsAt).getTime() + 3 * 60 * 60 * 1000).toISOString(),
      presale_starts_at: input.presaleStartsAt
        ? this.toEventIso(...input.presaleStartsAt.split('T', 2) as [string, string])
        : null
    };
  }

  private mapAdminInputToFormData(input: EventAdminInput, update = false): FormData {
    const payload = this.mapAdminInputToLaravel(input);
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== null && value !== undefined) formData.append(key, String(value));
    });
    formData.append('status', input.status === 'draft' ? 'borrador' : 'publicado');
    if (input.imageFile) formData.append('image', input.imageFile, input.imageFile.name);
    if (update) formData.append('_method', 'PUT');
    return formData;
  }

  private saveSectionPrices(event: LaravelEvent, input: EventAdminInput): Observable<LaravelEvent> {
    return this.api.get<LaravelSection[]>(`/sections/venue/${input.venueId}`).pipe(
      switchMap((sections) => {
        if (sections.length === 0) return of(event);

        const prices = new Map(input.priceTiers.map((tier) => [this.normalizeName(tier.name), tier.price]));
        const payload = {
          event_id: Number(event.id),
          sections: sections.map((section) => ({
            section_id: Number(section.id),
            price: prices.get(this.normalizeName(section.name)) ?? input.basePrice
          }))
        };

        return this.api.post('/event-sections-price', payload).pipe(map(() => event));
      })
    );
  }

  private extractLaravelEvents(response: LaravelEventListResponse): LaravelEvent[] {
    if (Array.isArray(response)) {
      return response;
    }

    if ('items' in response && Array.isArray(response.items)) {
      return response.items;
    }

    return response.data ?? [];
  }

  private mapLaravelEvent(event: LaravelEvent): EventItem {
    const date = this.normalizeApiDate(event.starts_at) ?? new Date().toISOString();
    const venue = event.venue;
    const sections = venue?.sections ?? [];
    const seats = sections.flatMap((section) => section.seats ?? []);
    const prices = seats.map((seat) => Number(seat.price)).filter((price) => Number.isFinite(price));
    const basePrice = Number(event.base_price ?? (prices.length > 0 ? Math.min(...prices) : 0));

    return {
      id: String(event.id),
      venueId: venue?.id,
      slug: this.slugify(event.title),
      name: event.title,
      category: event.category ?? 'general',
      city: venue?.city ?? 'Guatemala',
      date,
      time: new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(date)),
      location: venue?.name ?? 'Venue pendiente',
      venueName: venue?.name ?? 'Venue pendiente',
      address: venue?.address ?? '',
      image: event.image_url || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80',
      pdfImage: event.image_url ? `${environment.apiBaseUrl}/events/${event.id}/image` : undefined,
      bannerColor: '#6a00ff',
      basePrice,
      description: event.description ?? '',
      shortDescription: (event.description ?? '').slice(0, 120),
      featured: event.status === 'publicado',
      status: this.mapStatusFromLaravel(event.status),
      tags: [event.category ?? 'general'].filter(Boolean),
      metrics: {
        interested: 0,
        ticketsLeft: Number(event.capacity) || seats.filter((seat) => seat.state === 'available').length || seats.length,
        rating: 4.7
      },
      priceTiers: event.price_tiers?.length
        ? event.price_tiers.map((tier) => ({
            name: tier.name,
            price: Number(tier.price),
            description: `Sector ${tier.name}.`,
            availability: 'available' as const
          }))
        : this.mapPriceTiers(sections, basePrice)
    };
  }

  getEventLocalParts(value: string): { date: string; time: string } {
    const normalized = this.normalizeApiDate(value) ?? value;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date(normalized));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
    return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
  }

  private toEventIso(date: string, time = '19:00'): string {
    return new Date(`${date}T${time || '19:00'}:00-06:00`).toISOString();
  }

  private normalizeApiDate(value?: string | null): string | null {
    if (!value) return null;
    if (/Z$|[+-]\d{2}:?\d{2}$/.test(value)) return value;
    return `${value.replace(' ', 'T')}Z`;
  }

  private mapPriceTiers(sections: LaravelVenueSection[], basePrice: number): EventPriceTier[] {
    const tiers = sections.map((section) => {
      const prices = (section.seats ?? []).map((seat) => Number(seat.price)).filter((price) => Number.isFinite(price));
      const price = prices.length > 0 ? Math.min(...prices) : basePrice;

      return {
        name: section.name,
        price,
        description: `Sector ${section.name}.`,
        availability: 'available' as const
      };
    });

    return tiers.length > 0 ? tiers : this.defaultPriceTiers(basePrice);
  }

  private mapStatusFromLaravel(status: LaravelEvent['status']): EventItem['status'] {
    if (status === 'borrador') return 'draft';
    if (status === 'eliminado' || status === 'expirado') return 'sold-out';
    return 'on-sale';
  }

  private normalizeName(value: string): string {
    return value.trim().toLocaleLowerCase('es-GT');
  }

  private defaultPriceTiers(basePrice: number): EventPriceTier[] {
    return [
      { name: 'General', price: basePrice, description: 'Acceso general.', availability: 'available' }
    ];
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
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

export interface EventAdminInput {
  name: string;
  category: string;
  city: string;
  date: string;
  time: string;
  location: string;
  venueId: number | string;
  venueName: string;
  address: string;
  description: string;
  shortDescription: string;
  image: string;
  imageFile?: File | null;
  bannerColor: string;
  basePrice: number;
  capacity: number;
  interested: number;
  presaleStartsAt: string;
  status: EventItem['status'];
  tags: string[];
  priceTiers: EventPriceTier[];
}

interface LaravelEventListResponse {
  data?: LaravelEvent[];
  items?: LaravelEvent[];
  pagination?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

interface LaravelEvent {
  id: number | string;
  title: string;
  description?: string | null;
  category?: string | null;
  image_url?: string | null;
  base_price?: number | string | null;
  price_tiers?: Array<{
    section_id: number | string;
    name: string;
    price: number | string;
  }>;
  capacity?: number | string | null;
  status: 'borrador' | 'publicado' | 'eliminado' | 'expirado';
  starts_at?: string | null;
  ends_at?: string | null;
  published_at?: string | null;
  venue?: LaravelVenue | null;
}

interface LaravelVenue {
  id: number | string;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  sections?: LaravelVenueSection[];
}

interface LaravelVenueSection {
  id: number | string;
  name: string;
  code?: string | null;
  seats?: LaravelSeat[];
}

interface LaravelSeat {
  id: number | string;
  price: number | string;
  state?: 'available' | 'reserved' | 'sold';
}

interface LaravelSection {
  id: number | string;
  name: string;
}

interface LaravelEventInput {
  venue_id: number;
  title: string;
  description: string;
  category: string;
  image_url: string | null;
  base_price: number;
  capacity: number;
  starts_at: string;
  ends_at: string;
  presale_starts_at: string | null;
}
