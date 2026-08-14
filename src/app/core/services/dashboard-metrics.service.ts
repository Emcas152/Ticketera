import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DashboardMetrics {
  approved_sales: number;
  total_revenue: number;
  cash_revenue: number;
  visalink_revenue?: number;
  compraclic_revenue?: number;
  transfer_revenue?: number;
  card_revenue?: number;
  payment_methods?: Array<{ method: string; bookings_count: number; revenue: number }>;
  sold_tickets: number;
  occupied_seats: number;
  capacity: number;
  available_tickets: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardMetricsService {
  private readonly http = inject(HttpClient);

  get(eventIds: string[], dateFrom?: string, paymentMethod?: string): Observable<{ data: DashboardMetrics }> {
    let params = new HttpParams().set('event_ids', eventIds.join(','));
    if (dateFrom) params = params.set('date_from', dateFrom);
    if (paymentMethod) params = params.set('payment_method', paymentMethod);

    return this.http.get<{ data: DashboardMetrics }>(
      `${environment.apiBaseUrl.replace(/\/+$/, '')}/admin/dashboard-metrics`,
      { params }
    );
  }
}
