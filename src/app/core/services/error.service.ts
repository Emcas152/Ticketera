import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NotificationService } from './notification.service';

export type ErrorContext = 'general' | 'login' | 'courtesy';

@Injectable({ providedIn: 'root' })
export class ErrorService {
  private readonly notifications = inject(NotificationService);

  handleHttpError(error: HttpErrorResponse, context: ErrorContext = 'general'): void {
    this.notifications.error(this.getMessage(error, context));
  }

  getMessage(error: HttpErrorResponse, context: ErrorContext = 'general'): string {
    if (error.status === 0) return 'No se pudo conectar con el servidor. Verifica que la API esté disponible y permita solicitudes desde este sitio.';
    if (error.status === 401) {
      return context === 'login' ? 'El correo o la contraseña son incorrectos.' : 'Tu sesión venció o no tienes autorización. Inicia sesión nuevamente.';
    }
    if (error.status === 403) return 'No tienes permisos para realizar esta acción.';

    const apiMessage = this.extractApiMessage(error.error);
    if (apiMessage) return apiMessage;

    if (error.status === 404) return 'No se encontró el recurso solicitado.';
    if (error.status === 409) return 'La operación entra en conflicto con un registro existente.';
    if (error.status === 422) {
      return context === 'courtesy'
        ? 'No se pudo emitir la cortesía. Revisa el beneficiario, el cupo disponible y los asientos seleccionados.'
        : 'Revisa los datos ingresados e inténtalo nuevamente.';
    }
    if (error.status === 429) return 'Se realizaron demasiados intentos. Espera un momento antes de continuar.';
    if (error.status >= 500) {
      return context === 'courtesy'
        ? 'El servidor no pudo emitir la cortesía. La reserva puede haber quedado pendiente; actualiza la disponibilidad antes de reintentar.'
        : 'El servidor encontró un problema. Inténtalo nuevamente más tarde.';
    }
    return context === 'courtesy'
      ? `No se pudo emitir la cortesía (código ${error.status}).`
      : `No se pudo completar la solicitud (código ${error.status}).`;
  }

  private extractApiMessage(payload: unknown): string | null {
    if (typeof payload === 'string') return payload.trim() || null;
    if (!payload || typeof payload !== 'object') return null;
    const response = payload as Record<string, unknown>;
    const validationMessage = this.extractValidationMessage(response['errors']);
    if (validationMessage) return validationMessage;
    for (const key of ['message', 'error', 'detail', 'description']) {
      const value = response[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  }

  private extractValidationMessage(errors: unknown): string | null {
    if (!errors || typeof errors !== 'object') return null;
    const first = Object.values(errors as Record<string, unknown[]>).flat().find((value) => typeof value === 'string');
    return typeof first === 'string' ? first : null;
  }
}
