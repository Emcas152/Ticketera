import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class ErrorService {
  private readonly notifications = inject(NotificationService);

  handleHttpError(error: HttpErrorResponse): void {
    const message = this.buildMessage(error);
    this.notifications.error(message);
  }

  private buildMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'No fue posible conectar con la API. Verifica la URL base o el estado del backend.';
    }

    if (typeof error.error === 'string' && error.error.trim()) {
      return error.error;
    }

    if (error.error && typeof error.error === 'object') {
      const apiMessage = 'message' in error.error ? error.error.message : undefined;
      if (typeof apiMessage === 'string' && apiMessage.trim()) {
        return apiMessage;
      }
    }

    return `La solicitud fallo con codigo ${error.status}.`;
  }
}
