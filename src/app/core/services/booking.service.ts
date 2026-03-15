import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, delay, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MOCK_BOOKINGS, MOCK_EVENTS, MOCK_SEAT_MAPS } from '../mocks/mock-data';
import { BookingRecord, BookingTotals } from '../models/booking.model';
import { EventItem } from '../models/event.model';
import { Seat, SeatMap } from '../models/seat.model';
import { ApiService } from './api.service';
import { NotificationService } from './notification.service';
import { StorageService } from './storage.service';

interface BookingCartState {
  eventId: string | null;
  seats: Seat[];
}

const EMPTY_CART: BookingCartState = {
  eventId: null,
  seats: []
};

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(StorageService);
  private readonly notifications = inject(NotificationService);
  private readonly cartKey = 'pulse-booking-cart';
  private readonly historyKey = 'pulse-booking-history';
  private readonly currentBookingKey = 'pulse-current-booking';

  private readonly cartSubject = new BehaviorSubject<BookingCartState>(
    this.storage.getItem<BookingCartState>(this.cartKey, EMPTY_CART)
  );
  private readonly historySubject = new BehaviorSubject<BookingRecord[]>(
    this.storage.getItem<BookingRecord[]>(this.historyKey, MOCK_BOOKINGS)
  );
  private readonly currentBookingSubject = new BehaviorSubject<BookingRecord | null>(
    this.storage.getItem<BookingRecord | null>(this.currentBookingKey, null)
  );

  readonly cart$ = this.cartSubject.asObservable();
  readonly history$ = this.historySubject.asObservable();
  readonly currentBooking$ = this.currentBookingSubject.asObservable();

  getSeatMap(eventId: string): Observable<SeatMap | undefined> {
    if (environment.useMocks) {
      return of(MOCK_SEAT_MAPS[eventId]).pipe(delay(180));
    }

    return this.api.get<SeatMap>(`/events/${eventId}/seats`).pipe(map((seatMap) => seatMap ?? undefined));
  }

  setActiveEvent(eventId: string): void {
    const current = this.cartSubject.value;

    if (current.eventId === eventId) {
      return;
    }

    this.persistCart({
      eventId,
      seats: []
    });
  }

  toggleSeat(seat: Seat): void {
    if (seat.status === 'reserved' || seat.status === 'sold') {
      return;
    }

    const current = this.cartSubject.value;
    const exists = current.seats.some((selectedSeat) => selectedSeat.id === seat.id);
    const nextSeats = exists
      ? current.seats.filter((selectedSeat) => selectedSeat.id !== seat.id)
      : [...current.seats, { ...seat, status: 'selected' as const }];

    this.persistCart({
      ...current,
      seats: nextSeats
    });
  }

  clearSelection(): void {
    this.persistCart({
      eventId: this.cartSubject.value.eventId,
      seats: []
    });
  }

  getSelectedSeats(): Seat[] {
    return this.cartSubject.value.seats;
  }

  getSelectedEvent(): EventItem | undefined {
    const eventId = this.cartSubject.value.eventId;
    return MOCK_EVENTS.find((event) => event.id === eventId);
  }

  getTotals(seats: Seat[]): BookingTotals {
    const subtotal = seats.reduce((sum, seat) => sum + seat.price, 0);
    const serviceFee = subtotal * 0.09;
    const taxes = subtotal * 0.05;

    return {
      subtotal,
      serviceFee,
      taxes,
      total: subtotal + serviceFee + taxes
    };
  }

  confirmReservation(paymentMethod = 'Visa ending in 4421'): Observable<BookingRecord> {
    const event = this.getSelectedEvent();
    const seats = this.getSelectedSeats();

    if (!event || seats.length === 0) {
      return of(this.currentBookingSubject.value as BookingRecord).pipe(
        tap(() => this.notifications.info('No hay asientos seleccionados.'))
      );
    }

    const booking: BookingRecord = {
      id: `booking-${Date.now()}`,
      orderNumber: `PLS-${String(Date.now()).slice(-6)}`,
      eventId: event.id,
      eventName: event.name,
      eventDate: event.date,
      venueName: event.venueName,
      seats,
      totals: this.getTotals(seats),
      createdAt: new Date().toISOString(),
      paymentMethod,
      status: 'confirmed',
      qrCode: `QR-${event.id}-${Date.now()}`
    };

    const request$ = environment.useMocks
      ? of(booking).pipe(delay(900))
      : this.api.post<BookingRecord>('/bookings/confirm', {
          eventId: event.id,
          seats: seats.map((seat) => seat.id),
          paymentMethod
        });

    return request$.pipe(
      tap((confirmedBooking) => {
        const nextHistory = [confirmedBooking, ...this.historySubject.value];
        this.historySubject.next(nextHistory);
        this.currentBookingSubject.next(confirmedBooking);
        this.storage.setItem(this.historyKey, nextHistory);
        this.storage.setItem(this.currentBookingKey, confirmedBooking);
        this.persistCart({
          eventId: event.id,
          seats: []
        });
        this.notifications.success('Reserva confirmada. Ticket generado.');
      })
    );
  }

  getReservations(): Observable<BookingRecord[]> {
    if (environment.useMocks) {
      return this.history$;
    }

    return this.api.get<BookingRecord[]>('/bookings/my-reservations');
  }

  private persistCart(cart: BookingCartState): void {
    this.cartSubject.next(cart);
    this.storage.setItem(this.cartKey, cart);
  }
}
