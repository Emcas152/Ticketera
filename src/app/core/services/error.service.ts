import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class ErrorService {
  private readonly notifications = inject(NotificationService);

  handleHttpError(error: HttpErrorResponse): void {
    const message = this.getMessage(error);
    this.notifications.error(message);
  }

  getMessage(error: HttpErrorResponse, context: 'general' | 'login' = 'general'): string {
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica que la API esté disponible y permita solicitudes desde este sitio.';
    }

    if (error.status === 401) {
      return context === 'login'
        ? 'El correo o la contraseña son incorrectos.'
        : 'Tu sesión venció o no tienes autorización. Inicia sesión nuevamente.';
    }

    if (error.status === 403) {
      return 'No tienes permisos para realizar esta acción.';
    }

    if (error.status === 404) {
      return 'No se encontró el recurso solicitado.';
    }

    if (error.status === 409) {
      return 'La operación entra en conflicto con un registro existente.';
    }

    if (error.status === 422) {
      const validationMessage = this.extractValidationMessage(error.error);
      return validationMessage ?? 'Revisa los datos ingresados e inténtalo nuevamente.';
    }

    if (error.status === 429) {
      return 'Se realizaron demasiados intentos. Espera un momento antes de continuar.';
    }

    if (error.status >= 500) {
      return 'El servidor encontró un problema. Inténtalo nuevamente más tarde.';
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

    return `No se pudo completar la solicitud (código ${error.status}).`;
  }

  private extractValidationMessage(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object' || !('errors' in payload)) return null;
    const errors = payload.errors;
    if (!errors || typeof errors !== 'object') return null;

    const first = Object.values(errors as Record<string, unknown[]>).flat().find((value) => typeof value === 'string');
    return typeof first === 'string' ? first : null;
  }
}
