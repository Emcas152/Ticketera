import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

export interface CourtesyLimit {
  id?: number | string;
  eventId: number | string;
  maximum: number;
  used: number;
  available: number;
}

@Injectable({ providedIn: 'root' })
export class CourtesyLimitService {
  private readonly api = inject(ApiService);

  getByEvent(eventId: number | string): Observable<CourtesyLimit> {
    return this.api.get<Record<string, unknown>>(`/courtesy-limits/${eventId}`).pipe(
      map((response) => this.normalize(response, eventId))
    );
  }

  save(eventId: number | string, maximum: number, id?: number | string): Observable<CourtesyLimit> {
    const payload = {
      event_id: Number(eventId),
      limit_qty: maximum
    };
    const request = id == null
      ? this.api.post<Record<string, unknown>>('/courtesy-limits', payload)
      : this.api.put<Record<string, unknown>>(`/courtesy-limits/${id}`, payload);
    return request.pipe(map((response) => this.normalize(response, eventId, maximum)));
  }

  private normalize(data: Record<string, unknown>, eventId: number | string, fallbackMaximum = 0): CourtesyLimit {
    const maximum = this.number(data, ['limit_qty', 'maximum', 'quota', 'limit'], fallbackMaximum);
    const used = this.number(data, ['used_qty', 'used', 'courtesies_used'], 0);
    const available = this.number(data, ['available', 'available_courtesies', 'remaining'], Math.max(0, maximum - used));
    return { id: data['id'] as number | string | undefined, eventId, maximum, used, available };
  }

  private number(data: Record<string, unknown>, keys: string[], fallback: number): number {
    for (const key of keys) {
      const value = Number(data[key]);
      if (Number.isFinite(value)) return value;
    }
    return fallback;
  }
}
