import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, delay, map, of, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MOCK_BOOKINGS, MOCK_EVENTS, MOCK_SEAT_MAPS } from '../mocks/mock-data';
import { BookingRecord, BookingTotals, PaymentDetails, PaymentResult } from '../models/booking.model';
import { EventItem } from '../models/event.model';
import { Seat, SeatMap } from '../models/seat.model';
import { ApiService } from './api.service';
import { NotificationService } from './notification.service';
import { StorageService } from './storage.service';

interface BookingCartState {
  eventId: string | null;
  seats: Seat[];
  holdExpiresAt: string | null;
}

const EMPTY_CART: BookingCartState = {
  eventId: null,
  seats: [],
  holdExpiresAt: null
};

const HOLD_DURATION_MS = 5 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(StorageService);
  private readonly notifications = inject(NotificationService);
  private readonly cartKey = 'pulse-booking-cart';
  private readonly historyKey = 'pulse-booking-history';
  private readonly currentBookingKey = 'pulse-current-booking';
  private readonly soldSeatsKey = 'pulse-sold-seats';
  private holdTimeoutId: ReturnType<typeof setTimeout> | null = null;

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
  readonly holdExpiresAt$ = this.cart$.pipe(map((cart) => cart.holdExpiresAt));
  readonly history$ = this.historySubject.asObservable();
  readonly currentBooking$ = this.currentBookingSubject.asObservable();

  constructor() {
    this.expireHoldIfNeeded();
    this.scheduleHoldExpiration();
  }

  getSeatMap(eventId: string): Observable<SeatMap | undefined> {
    if (environment.useMocks) {
      return of(this.applyLocalSeatState(MOCK_SEAT_MAPS[eventId])).pipe(delay(180));
    }

    return this.api.get<SeatMap>(`/events/${eventId}/seats`).pipe(map((seatMap) => seatMap ?? undefined));
  }

  setActiveEvent(eventId: string): void {
    const current = this.cartSubject.value;

    if (current.eventId === eventId) {
      return;
    }

    this.clearCurrentBooking();
    this.persistCart({
      eventId,
      seats: [],
      holdExpiresAt: null
    });
  }

  toggleSeat(seat: Seat): void {
    this.expireHoldIfNeeded();

    if (seat.status === 'reserved' || seat.status === 'sold') {
      return;
    }

    const current = this.cartSubject.value;
    const exists = current.seats.some((selectedSeat) => selectedSeat.id === seat.id);
    const nextSeats = exists
      ? current.seats.filter((selectedSeat) => selectedSeat.id !== seat.id)
      : [...current.seats, { ...seat, status: 'selected' as const }];

    this.clearCurrentBooking();
    this.persistCart({
      ...current,
      seats: nextSeats,
      holdExpiresAt: nextSeats.length > 0 ? new Date(Date.now() + HOLD_DURATION_MS).toISOString() : null
    });
  }

  clearSelection(): void {
    this.clearCurrentBooking();
    this.persistCart({
      eventId: this.cartSubject.value.eventId,
      seats: [],
      holdExpiresAt: null
    });
  }

  getSelectedSeats(): Seat[] {
    this.expireHoldIfNeeded();
    return this.cartSubject.value.seats;
  }

  getHoldExpiresAt(): string | null {
    this.expireHoldIfNeeded();
    return this.cartSubject.value.holdExpiresAt;
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

  processPayment(details: PaymentDetails): Observable<PaymentResult> {
    this.expireHoldIfNeeded();

    if (!this.cartSubject.value.holdExpiresAt || this.cartSubject.value.seats.length === 0) {
      return throwError(() => new Error('La reserva temporal expiro. Selecciona los asientos nuevamente.'));
    }

    const normalizedCard = details.cardNumber.replace(/\D/g, '');
    const lastFour = normalizedCard.slice(-4);
    const paymentMethod = `Visa ending in ${lastFour || '0000'}`;

    if (environment.useMocks) {
      const declined = normalizedCard.endsWith('0000');
      const result: PaymentResult = declined
        ? {
            status: 'declined',
            message: 'El banco rechazo la transaccion. Revisa los datos o usa otra tarjeta.',
            paymentMethod
          }
        : {
            status: 'approved',
            authorizationCode: `AUTH-${Date.now().toString().slice(-6)}`,
            message: 'Pago autorizado.',
            paymentMethod
          };

      return of(result).pipe(delay(900));
    }

    return this.api.post<PaymentResult>('/payments/confirm', {
      eventId: this.cartSubject.value.eventId,
      seats: this.cartSubject.value.seats.map((seat) => seat.id),
      cardholderName: details.cardholderName,
      cardNumber: normalizedCard,
      expiry: details.expiry,
      cvv: details.cvv
    });
  }

  confirmReservation(paymentMethod = 'Visa ending in 4421'): Observable<BookingRecord> {
    this.expireHoldIfNeeded();

    const event = this.getSelectedEvent();
    const seats = this.getSelectedSeats();

    if (!event || seats.length === 0) {
      return throwError(() => new Error('No hay asientos seleccionados o la reserva temporal expiro.'));
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
        this.markSeatsAsSold(event.id, confirmedBooking.seats.map((seat) => seat.id));
        this.historySubject.next(nextHistory);
        this.currentBookingSubject.next(confirmedBooking);
        this.storage.setItem(this.historyKey, nextHistory);
        this.storage.setItem(this.currentBookingKey, confirmedBooking);
        this.persistCart({
          eventId: event.id,
          seats: [],
          holdExpiresAt: null
        });
        this.notifications.success('Compra confirmada. Ticket generado.');
      })
    );
  }

  getReservations(): Observable<BookingRecord[]> {
    if (environment.useMocks) {
      return this.history$;
    }

    return this.api.get<BookingRecord[]>('/bookings/my-reservations');
  }

  clearCurrentBooking(): void {
    this.currentBookingSubject.next(null);
    this.storage.setItem(this.currentBookingKey, null);
  }

  private persistCart(cart: BookingCartState): void {
    this.cartSubject.next(cart);
    this.storage.setItem(this.cartKey, cart);
    this.scheduleHoldExpiration();
  }

  private expireHoldIfNeeded(): void {
    const cart = this.cartSubject.value;

    if (!cart.holdExpiresAt || new Date(cart.holdExpiresAt).getTime() > Date.now()) {
      return;
    }

    this.cartSubject.next({ eventId: cart.eventId, seats: [], holdExpiresAt: null });
    this.storage.setItem(this.cartKey, this.cartSubject.value);
    this.notifications.info('La reserva temporal expiro. Los asientos fueron liberados.');
  }

  private scheduleHoldExpiration(): void {
    if (this.holdTimeoutId) {
      clearTimeout(this.holdTimeoutId);
      this.holdTimeoutId = null;
    }

    const expiresAt = this.cartSubject.value.holdExpiresAt;
    if (!expiresAt) {
      return;
    }

    const delayMs = Math.max(new Date(expiresAt).getTime() - Date.now(), 0);
    this.holdTimeoutId = setTimeout(() => this.expireHoldIfNeeded(), delayMs + 100);
  }

  private applyLocalSeatState(seatMap: SeatMap | undefined): SeatMap | undefined {
    if (!seatMap) {
      return undefined;
    }

    this.expireHoldIfNeeded();

    const cart = this.cartSubject.value;
    const selectedIds = new Set(cart.eventId === seatMap.eventId ? cart.seats.map((seat) => seat.id) : []);
    const soldIds = new Set(this.storage.getItem<string[]>(this.soldSeatsKey, []));

    return {
      ...seatMap,
      sections: seatMap.sections.map((section) => ({
        ...section,
        seats: section.seats.map((seat) => this.applySeatStatus(seatMap.eventId, seat, selectedIds, soldIds))
      })),
      tables: seatMap.tables.map((table) => ({
        ...table,
        seats: table.seats.map((seat) => this.applySeatStatus(seatMap.eventId, seat, selectedIds, soldIds))
      }))
    };
  }

  private applySeatStatus(eventId: string, seat: Seat, selectedIds: Set<string>, soldIds: Set<string>): Seat {
    const soldKey = this.getSeatStorageKey(eventId, seat.id);

    if (soldIds.has(soldKey)) {
      return { ...seat, status: 'sold' };
    }

    if (selectedIds.has(seat.id)) {
      return { ...seat, status: 'selected' };
    }

    return seat;
  }

  private markSeatsAsSold(eventId: string, seatIds: string[]): void {
    const soldIds = new Set(this.storage.getItem<string[]>(this.soldSeatsKey, []));
    seatIds.forEach((seatId) => soldIds.add(this.getSeatStorageKey(eventId, seatId)));
    this.storage.setItem(this.soldSeatsKey, [...soldIds]);
  }

  private getSeatStorageKey(eventId: string, seatId: string): string {
    return `${eventId}:${seatId}`;
  }
}
