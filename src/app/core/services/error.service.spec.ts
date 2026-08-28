import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';
import { ErrorService } from './error.service';

describe('ErrorService', () => {
  let service: ErrorService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ErrorService, { provide: NotificationService, useValue: { error: () => undefined } }] });
    service = TestBed.inject(ErrorService);
  });

  it('muestra el mensaje enviado por el API aunque sea un error de servidor', () => {
    const error = new HttpErrorResponse({ status: 500, error: { message: 'El usuario no tiene cupo de cortesías disponible.' } });
    expect(service.getMessage(error, 'courtesy')).toBe('El usuario no tiene cupo de cortesías disponible.');
  });

  it('prioriza el primer detalle de validación de Laravel', () => {
    const error = new HttpErrorResponse({ status: 422, error: { message: 'The given data was invalid.', errors: { booking_id: ['La reserva ya fue procesada.'] } } });
    expect(service.getMessage(error, 'courtesy')).toBe('La reserva ya fue procesada.');
  });

  it('usa un mensaje específico de cortesía cuando el API no envía detalle', () => {
    const error = new HttpErrorResponse({ status: 500, error: null });
    expect(service.getMessage(error, 'courtesy')).toContain('no pudo emitir la cortesía');
  });
});
