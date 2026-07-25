import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, of, tap } from 'rxjs';
import { Venue, VenueInput } from '../models/venue.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class VenueService {
  private readonly api = inject(ApiService);
  private readonly venuesSubject = new BehaviorSubject<Venue[]>([]);

  readonly venues$ = this.venuesSubject.asObservable();

  getVenues(activeOnly = false): Observable<Venue[]> {
    return this.api.get<VenueCollection | LaravelVenue[]>('/venues', activeOnly ? { active_only: true } : undefined).pipe(
      map((response) => (Array.isArray(response) ? response : response.data)),
      map((venues) => venues.map((venue) => this.mapLaravelVenue(venue))),
      tap((venues) => this.venuesSubject.next(venues))
    );
  }

  createVenue(input: VenueInput): Observable<Venue> {
    return this.api
      .post<LaravelVenue | VenueResource>('/venues', input)
      .pipe(map((response) => this.mapLaravelVenue(this.unwrapResource(response))));
  }

  getVenueSections(venueId: number | string): Observable<VenueSection[]> {
    return this.api.get<VenueSection[]>(`/sections/venue/${venueId}`);
  }

  createSection(input: CreateSectionInput): Observable<VenueSection> {
    return this.api.post<VenueSection>('/sections', input);
  }

  generateSeats(input: GenerateSeatsInput): Observable<unknown> {
    return this.api.post('/seats/generate', input);
  }

  getSeatMap(venueId: number | string): Observable<VenueSeatMap | null> {
    return this.api.get<VenueSeatMap | null>(`/venues/${venueId}/seat-map`);
  }

  saveSeatMap(venueId: number | string, input: VenueSeatMapInput): Observable<VenueSeatMap> {
    return this.api.put<VenueSeatMap>(`/venues/${venueId}/seat-map`, input);
  }

  updateVenue(venueId: number | string, input: VenueInput): Observable<Venue> {
    return this.api
      .put<LaravelVenue | VenueResource>(`/venues/${venueId}`, input)
      .pipe(map((response) => this.mapLaravelVenue(this.unwrapResource(response))));
  }

  activateVenue(venueId: number | string): Observable<Venue> {
    return this.setLocalVenueStatus(venueId, 'active');
  }

  deactivateVenue(venueId: number | string): Observable<Venue> {
    return this.setLocalVenueStatus(venueId, 'inactive');
  }

  private setLocalVenueStatus(venueId: number | string, status: Venue['status']): Observable<Venue> {
    const current = this.venuesSubject.value.find((venue) => String(venue.id) === String(venueId));
    const updated = { ...(current ?? { id: venueId, name: '', address: '', city: '', country: 'GT', seatMapConfig: null }), status };

    this.venuesSubject.next(
      this.venuesSubject.value.map((venue) => (String(venue.id) === String(venueId) ? updated : venue))
    );

    return of(updated);
  }

  private unwrapResource(response: LaravelVenue | VenueResource): LaravelVenue {
    return 'data' in response ? response.data : response;
  }

  private mapLaravelVenue(venue: LaravelVenue): Venue {
    return {
      id: venue.id,
      name: venue.name,
      address: venue.address ?? '',
      city: venue.city ?? '',
      country: venue.country ?? 'GT',
      status: venue.status ?? 'active',
      seatMapConfig: venue.seat_map_config ?? null
    };
  }
}

interface VenueCollection {
  data: LaravelVenue[];
}

interface VenueResource {
  data: LaravelVenue;
}

interface LaravelVenue {
  id: number | string;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  status?: 'active' | 'inactive';
  seat_map_config?: Record<string, unknown> | null;
}

export interface VenueSection {
  id: number | string;
  venue_id?: number | string;
  name: string;
  code?: string | null;
}

export interface CreateSectionInput {
  venue_id: number;
  name: string;
  code: string;
}

export interface GenerateSeatsInput {
  section_id: number;
  rows: string;
  seats_per_row: number;
}

export interface VenueSeatMapInput {
  canvas_width: number;
  canvas_height: number;
  elements: unknown[];
  sections: unknown[];
  tables: unknown[];
  total_seats: number;
  total_tables: number;
}

export interface VenueSeatMap extends VenueSeatMapInput {
  id: number | string;
  venue_id: number | string;
  version: number;
  updated_by?: number | string | null;
}
