import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PaymentMaintenanceSetting {
  enabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class SystemSettingsService {
  private readonly api = inject(ApiService);

  getPaymentMaintenance(): Observable<PaymentMaintenanceSetting> {
    return this.api.get<PaymentMaintenanceSetting>('/system-settings/payment-maintenance');
  }

  updatePaymentMaintenance(enabled: boolean): Observable<PaymentMaintenanceSetting> {
    return this.api.put<PaymentMaintenanceSetting>('/admin/system-settings/payment-maintenance', { enabled });
  }
}
