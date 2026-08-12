import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminBookingFilters, AdminBookingPage } from '../models/admin-booking.model';

@Injectable({ providedIn: 'root' })
export class AdminBookingService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl.replace(/\/+$/, '')}/bookings`;

  list(filters: AdminBookingFilters): Observable<AdminBookingPage> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('per_page', filters.per_page);

    for (const [key, value] of Object.entries(filters)) {
      if (!['page', 'per_page'].includes(key) && value !== '') {
        params = params.set(key, String(value));
      }
    }

    return this.http.get<AdminBookingPage>(this.url, { params });
  }

  releaseSeats(bookingId: number): Observable<{
    success: boolean;
    message: string;
    data: { booking_id: number; status: string; released_seats: number };
  }> {
    return this.http.post<{
      success: boolean;
      message: string;
      data: { booking_id: number; status: string; released_seats: number };
    }>(`${this.url}/${bookingId}/release-seats`, {});
  }
}
