import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AdminBookingService } from './admin-booking.service';

describe('AdminBookingService', () => {
  let service: AdminBookingService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AdminBookingService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AdminBookingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envia filtros activos y paginacion al servidor', () => {
    service.list({
      status: 'reservado',
      event_id: '7',
      search: 'ABC',
      date_from: '2026-07-01',
      date_to: '2026-07-31',
      page: 2,
      per_page: 20
    }).subscribe();

    const request = http.expectOne((candidate) =>
      candidate.url === `${environment.apiBaseUrl}/bookings`
    );

    expect(request.request.params.get('status')).toBe('reservado');
    expect(request.request.params.get('event_id')).toBe('7');
    expect(request.request.params.get('search')).toBe('ABC');
    expect(request.request.params.get('date_from')).toBe('2026-07-01');
    expect(request.request.params.get('date_to')).toBe('2026-07-31');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('per_page')).toBe('20');

    request.flush({
      data: [],
      meta: { current_page: 2, last_page: 2, per_page: 20, total: 21 }
    });
  });

  it('omite filtros vacios', () => {
    service.list({
      status: '',
      event_id: '',
      search: '',
      date_from: '',
      date_to: '',
      page: 1,
      per_page: 20
    }).subscribe();

    const request = http.expectOne((candidate) =>
      candidate.url === `${environment.apiBaseUrl}/bookings`
    );

    expect(request.request.params.has('status')).toBe(false);
    expect(request.request.params.has('search')).toBe(false);
    request.flush({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 }
    });
  });

  it('solicita liberar los asientos de una reserva', () => {
    service.releaseSeats(42).subscribe((response) => {
      expect(response.data.released_seats).toBe(2);
    });

    const request = http.expectOne(`${environment.apiBaseUrl}/bookings/42/release-seats`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({
      success: true,
      message: 'Asientos liberados correctamente.',
      data: { booking_id: 42, status: 'cancelado', released_seats: 2 }
    });
  });
});
