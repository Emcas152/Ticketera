import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, delay, map, of, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MOCK_BOOKINGS, MOCK_EVENTS, MOCK_SEAT_MAPS } from '../mocks/mock-data';
import { BookingRecord, BookingTotals, PaymentDetails, PaymentResult } from '../models/booking.model';
import { EventItem, EventPriceTier } from '../models/event.model';
import { Seat, SeatMap, SeatSection, SeatTable } from '../models/seat.model';
import { ApiService } from './api.service';
import { NotificationService } from './notification.service';
import { StorageService } from './storage.service';
import { createSecureTicketQr, parseSecureTicketQr } from '../utils/secure-ticket-qr';

interface BookingCartState {
  eventId: string | null;
  seats: Seat[];
  holdExpiresAt: string | null;
}

export interface TicketValidationResult {
  status: 'valid' | 'used' | 'invalid' | 'unknown';
  message: string;
  booking?: BookingRecord;
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
  private readonly activeEventKey = 'pulse-active-event';
  private readonly soldSeatsKey = 'pulse-sold-seats';
  private holdTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private pendingApiBooking: BookingRecord | null = null;

  private readonly cartSubject = new BehaviorSubject<BookingCartState>(
    this.storage.getItem<BookingCartState>(this.cartKey, EMPTY_CART)
  );
  private readonly historySubject = new BehaviorSubject<BookingRecord[]>(
    this.storage.getItem<BookingRecord[]>(this.historyKey, MOCK_BOOKINGS)
  );
  private readonly currentBookingSubject = new BehaviorSubject<BookingRecord | null>(
    this.storage.getItem<BookingRecord | null>(this.currentBookingKey, null)
  );
  private readonly activeEventSubject = new BehaviorSubject<EventItem | null>(
    this.storage.getItem<EventItem | null>(this.activeEventKey, null)
  );

  readonly cart$ = this.cartSubject.asObservable();
  readonly holdExpiresAt$ = this.cart$.pipe(map((cart) => cart.holdExpiresAt));
  readonly history$ = this.historySubject.asObservable();
  readonly currentBooking$ = this.currentBookingSubject.asObservable();

  constructor() {
    this.migrateInsecureLocalTickets();
    this.expireHoldIfNeeded();
    this.scheduleHoldExpiration();
  }

  getSeatMap(eventId: string): Observable<SeatMap | undefined> {
    if (environment.useMocks) {
      return of(this.applyLocalSeatState(MOCK_SEAT_MAPS[eventId])).pipe(delay(180));
    }

    return this.api.get<LaravelSeatMapSection[]>(`/events/${eventId}/seat-map`).pipe(
      map((sections) => this.mapLaravelSeatMap(eventId, sections)),
      map((seatMap) => seatMap ?? undefined)
    );
  }

  setActiveEvent(eventId: string, event?: EventItem): void {
    if (event) {
      this.activeEventSubject.next(event);
      this.storage.setItem(this.activeEventKey, event);
    }

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
    const activeEvent = this.activeEventSubject.value;

    if (activeEvent?.id === eventId) {
      return activeEvent;
    }

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
    const cardBrand = this.detectCardBrand(normalizedCard);
    const paymentMethod = `${cardBrand} ending in ${lastFour || '0000'}`;

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

    const eventId = this.cartSubject.value.eventId;

    if (!eventId) {
      return throwError(() => new Error('No hay evento activo para procesar el pago.'));
    }

    return this.api
      .post<LaravelBookingReservation>('/bookings', {
        event_id: Number(eventId),
        seat_ids: this.cartSubject.value.seats.map((seat) => Number(seat.id))
      })
      .pipe(
        switchMap((booking) =>
          this.api.post<LaravelPaymentResponse>('/bookings/pay', {
            booking_id: Number(booking.booking_id),
            ticket_type: 'tarjeta',
            payment_method: 'tarjeta',
            number_target: normalizedCard || undefined,
            month_target: details.expiry.split('/')[0] || undefined,
            year_target: details.expiry.split('/')[1] || undefined,
            cvc_target: details.cvv || undefined,
            name_target: details.cardholderName || undefined,
            nit: 'C/F'
          }).pipe(map((payment) => ({ booking, payment })))
        ),
        switchMap(({ booking, payment }) =>
          this.api
            .get<LaravelBookingSummary>(`/bookings/${booking.booking_id}/summary`)
            .pipe(map((summary) => ({ booking, payment, summary })))
        ),
        tap(({ summary }) => {
          this.pendingApiBooking = this.mapLaravelBookingSummary(summary);
        }),
        map(({ payment }) => ({
          status: payment.success ? 'approved' : 'declined',
          authorizationCode: payment.payment_id ? String(payment.payment_id) : undefined,
          message: payment.message ?? (payment.success ? 'Pago autorizado.' : 'Pago pendiente.'),
          paymentMethod
        }))
      );
  }

  generateCourtesyTickets(bookingId: number | string): Observable<{ success: boolean; message?: string; booking_id?: number | string; tickets_count?: number }> {
    if (environment.useMocks) {
      return of({
        success: true,
        message: 'Tickets de cortesía generados exitosamente.',
        booking_id: bookingId,
        tickets_count: 1
      }).pipe(delay(400));
    }

    return this.api.post<{ success: boolean; message?: string; booking_id?: number | string; tickets_count?: number }>('/tickets/courtesy', {
      booking_id: Number(bookingId)
    });
  }

  assignCourtesySeats(eventId: number | string, seatIds: Array<number | string>, beneficiaryName = 'Cortesía VIP'): Observable<{ success: boolean; message?: string; tickets_count?: number }> {
    if (!seatIds || seatIds.length === 0) {
      return throwError(() => new Error('No hay asientos o mesas seleccionadas para asignar cortesía.'));
    }

    if (environment.useMocks) {
      this.markSeatsAsSold(String(eventId), seatIds.map(String));
      this.clearSelection();
      this.notifications.success(`Cortesía (${beneficiaryName}) asignada a ${seatIds.length} asiento(s).`);
      return of({
        success: true,
        message: 'Cortesía asignada con éxito.',
        tickets_count: seatIds.length
      }).pipe(delay(500));
    }

    return this.api
      .post<LaravelBookingReservation>('/bookings', {
        event_id: Number(eventId),
        seat_ids: seatIds.map((id) => Number(id))
      })
      .pipe(
        switchMap((booking) => this.generateCourtesyTickets(booking.booking_id)),
        tap(() => {
          this.markSeatsAsSold(String(eventId), seatIds.map(String));
          this.clearSelection();
          this.notifications.success(`Cortesía (${beneficiaryName}) asignada con éxito.`);
        })
      );
  }

  private detectCardBrand(cardNumber: string): string {
    if (/^4/.test(cardNumber)) return 'Visa';
    if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(cardNumber)) return 'Mastercard';
    if (/^3[47]/.test(cardNumber)) return 'American Express';
    return 'Card';
  }

  confirmReservation(paymentMethod = 'Visa ending in 4421'): Observable<BookingRecord> {
    this.expireHoldIfNeeded();

    const event = this.getSelectedEvent();
    const seats = this.getSelectedSeats();

    if (!event || seats.length === 0) {
      return throwError(() => new Error('No hay asientos seleccionados o la reserva temporal expiro.'));
    }

    if (!environment.useMocks) {
      const confirmed = this.pendingApiBooking;

      if (!confirmed) {
        return throwError(() => new Error('No hay una reserva pagada para confirmar.'));
      }

      return of({ ...confirmed, paymentMethod }).pipe(
        tap((confirmedBooking) => this.persistConfirmedBooking(event.id, confirmedBooking))
      );
    }

    const booking: BookingRecord = {
      id: `booking-${Date.now()}`,
      orderNumber: `PLS-${String(Date.now()).slice(-6)}`,
      eventId: event.id,
      eventName: event.name,
      eventImage: event.pdfImage ?? event.image,
      eventDate: event.date,
      venueName: event.venueName,
      seats,
      totals: this.getTotals(seats),
      createdAt: new Date().toISOString(),
      paymentMethod,
      status: 'confirmed',
      qrCode: createSecureTicketQr(),
      usedAt: null
    };

    const request$ = environment.useMocks
      ? of(booking).pipe(delay(900))
      : this.api.post<BookingRecord>('/bookings/confirm', {
          eventId: event.id,
          seats: seats.map((seat) => seat.id),
          paymentMethod
        });

    return request$.pipe(tap((confirmedBooking) => this.persistConfirmedBooking(event.id, confirmedBooking)));
  }

  getReservations(): Observable<BookingRecord[]> {
    if (environment.useMocks) {
      return this.history$;
    }

    return this.api.get<LaravelBooking[], { per_page: number }>('/bookings', { per_page: 100 }).pipe(
      map(bookings => bookings.map(booking => this.mapLaravelBooking(booking)))
    );
  }

  issueManualEntry(
    event: EventItem,
    seats: Seat[],
    type: 'cash' | 'courtesy',
    customerName: string,
    customerPhone = '',
    payment: ManualPaymentDetails = { customerEmail: '', paymentMethod: 'efectivo', authorizationNumber: '', proofFile: null }
  ): Observable<BookingRecord> {
    if (seats.length === 0) {
      return throwError(() => new Error('Selecciona al menos un asiento disponible en el mapa.'));
    }

    if (seats.some((seat) => seat.status === 'reserved' || seat.status === 'sold')) {
      return throwError(() => new Error('Uno de los asientos seleccionados ya no está disponible.'));
    }

    const seatIds = seats.map((seat) => seat.id);

    if (environment.useMocks) {
      const totals = type === 'courtesy'
        ? { subtotal: 0, serviceFee: 0, taxes: 0, total: 0 }
        : this.getTotals(seats);
      const booking: BookingRecord = {
        id: `booking-${type}-${Date.now()}`,
        orderNumber: `${type === 'cash' ? 'CASH' : 'CORT'}-${Date.now().toString().slice(-6)}`,
        eventId: event.id,
        eventName: event.name,
        eventImage: event.pdfImage ?? event.image,
        eventDate: event.date,
        venueName: event.venueName,
        seats: seats.map((seat) => ({ ...seat, status: 'sold' })),
        totals,
        createdAt: new Date().toISOString(),
        paymentMethod: `${type === 'cash' ? this.manualPaymentLabel(payment.paymentMethod) : 'Cortesía'}${customerName ? ` - ${customerName}` : ''}`,
        status: 'confirmed',
        qrCode: createSecureTicketQr(),
        usedAt: null
      };

      return of(booking).pipe(
        delay(350),
        tap((confirmed) => this.persistManualEntry(event.id, confirmed, seatIds, type))
      );
    }

    return this.api.post<LaravelBookingReservation>('/bookings', {
      event_id: Number(event.id),
      seat_ids: seatIds.map(Number),
      customer_name: customerName || undefined,
      customer_phone: customerPhone || undefined,
      customer_email: payment.customerEmail || undefined,
      beneficiary_email: type === 'courtesy' ? payment.customerEmail || undefined : undefined,
      payment_method: type === 'cash' ? payment.paymentMethod : 'cortesia',
      authorization_number: type === 'cash' ? payment.authorizationNumber || undefined : undefined,
      send_ticket_email: true
    }).pipe(
      switchMap((reservation) => {
        const issue$ = type === 'courtesy'
          ? this.generateCourtesyTickets(reservation.booking_id)
          : this.confirmManualPayment(reservation.booking_id, customerName, customerPhone, payment);

        return issue$.pipe(map(() => reservation));
      }),
      switchMap((reservation) =>
        this.api.get<LaravelBookingSummary>(`/bookings/${reservation.booking_id}/summary`)
      ),
      map((summary) => {
        const booking = this.mapLaravelBookingSummary(summary);
        return {
          ...booking,
          totals: type === 'courtesy'
            ? { subtotal: 0, serviceFee: 0, taxes: 0, total: 0 }
            : booking.totals,
          paymentMethod: `${type === 'cash' ? this.manualPaymentLabel(payment.paymentMethod) : 'Cortesía'}${customerName ? ` - ${customerName}` : ''}`
        };
      }),
      tap((confirmed) => this.persistManualEntry(event.id, confirmed, seatIds, type))
    );
  }

  private confirmManualPayment(
    bookingId: number | string,
    customerName: string,
    customerPhone: string,
    payment: ManualPaymentDetails
  ): Observable<LaravelPaymentResponse> {
    const payload = this.manualPaymentPayload(bookingId, customerName, customerPhone, payment);

    return this.api.post<LaravelPaymentResponse>('/bookings/manual-confirmation', payload).pipe(
      catchError((error: { status?: number }) => {
        if (error?.status !== 404) {
          return throwError(() => error);
        }

        // Compatibilidad con servidores que todavía no tienen desplegada la ruta
        // administrativa. Estos métodos se confirman localmente en el backend y no
        // deben enviarse a la pasarela de tarjetas.
        return this.api.post<LaravelPaymentResponse>('/bookings/pay', payload);
      })
    );
  }

  private manualPaymentPayload(
    bookingId: number | string,
    customerName: string,
    customerPhone: string,
    payment: ManualPaymentDetails
  ): FormData {
    const body = new FormData();
    body.append('booking_id', String(bookingId));
    body.append('ticket_type', payment.paymentMethod === 'efectivo' ? 'efectivo' : payment.paymentMethod);
    body.append('payment_method', payment.paymentMethod);
    body.append('nit', 'C/F');
    body.append('customer_name', customerName);
    body.append('customer_phone', customerPhone);
    body.append('customer_email', payment.customerEmail);
    if (payment.authorizationNumber) body.append('authorization_code', payment.authorizationNumber);
    if (payment.proofFile) body.append('payment_proof', payment.proofFile, payment.proofFile.name);
    body.append('send_ticket_email', '1');
    return body;
  }

  private manualPaymentLabel(method: ManualPaymentDetails['paymentMethod']): string {
    return ({ efectivo: 'Efectivo', visalink: 'VisaLink', compraclic: 'CompraClick', transferencia: 'Transferencia' })[method];
  }

  recordManualCashSale(event: EventItem, tier: EventPriceTier, quantity: number, customerName: string): Observable<BookingRecord> {
    const safeQuantity = Math.max(1, Math.min(Number(quantity) || 1, 20));
    const seats: Seat[] = Array.from({ length: safeQuantity }, (_, index) => ({
      id: `manual-${event.id}-${Date.now()}-${index + 1}`,
      row: 'MAN',
      number: index + 1,
      label: `Manual ${index + 1}`,
      section: tier.name,
      sectionId: this.slugify(tier.name),
      price: tier.price,
      status: 'selected',
      x: 0,
      y: 0,
      radius: 0
    }));

    const booking: BookingRecord = {
      id: `booking-cash-${Date.now()}`,
      orderNumber: `CASH-${Date.now().toString().slice(-6)}`,
      eventId: event.id,
      eventName: event.name,
      eventImage: event.pdfImage ?? event.image,
      eventDate: event.date,
      venueName: event.venueName,
      seats,
      totals: this.getTotals(seats),
      createdAt: new Date().toISOString(),
      paymentMethod: `Efectivo${customerName ? ` - ${customerName}` : ''}`,
      status: 'confirmed',
      qrCode: createSecureTicketQr(),
      usedAt: null
    };

    return of(booking).pipe(
      delay(environment.useMocks ? 350 : 150),
      tap((confirmedBooking) => {
        const nextHistory = [confirmedBooking, ...this.historySubject.value];
        this.historySubject.next(nextHistory);
        this.currentBookingSubject.next(confirmedBooking);
        this.storage.setItem(this.historyKey, nextHistory);
        this.storage.setItem(this.currentBookingKey, confirmedBooking);
        this.notifications.success('Venta en efectivo registrada. Entrada generada.');
      })
    );
  }

  private persistManualEntry(
    eventId: string,
    booking: BookingRecord,
    seatIds: string[],
    type: 'cash' | 'courtesy'
  ): void {
    const nextHistory = [booking, ...this.historySubject.value.filter((item) => item.id !== booking.id)];
    this.markSeatsAsSold(eventId, seatIds);
    this.historySubject.next(nextHistory);
    this.currentBookingSubject.next(booking);
    this.storage.setItem(this.historyKey, nextHistory);
    this.storage.setItem(this.currentBookingKey, booking);
    this.notifications.success(
      type === 'cash'
        ? 'Venta en efectivo registrada. Entrada generada.'
        : 'Entrada de cortesía generada.'
    );
  }

  validateTicketQr(payload: string): TicketValidationResult {
    const normalizedPayload = payload.trim();
    const token = parseSecureTicketQr(normalizedPayload);
    const secureQrCode = token ? `ALCON-TICKET:v1:${token}` : null;
    const booking = this.historySubject.value.find(
      (item) => item.qrCode === normalizedPayload || item.qrCode === secureQrCode
    );

    if (!booking) {
      if (!token && !this.looksLikeApiQrCode(normalizedPayload)) {
        return {
          status: 'invalid',
          message: 'QR rechazado. No pertenece al formato seguro de ALCON ni a un ticket emitido por la API.'
        };
      }

      return {
        status: 'unknown',
        message: 'QR con formato valido, pero no esta registrado en este sistema.'
      };
    }

    if (booking.status === 'used' || booking.usedAt) {
      return {
        status: 'used',
        message: `Ticket ya utilizado${booking.usedAt ? ` el ${this.formatValidationDate(booking.usedAt)}` : ''}.`,
        booking
      };
    }

    if (booking.status !== 'confirmed') {
      return {
        status: 'invalid',
        message: `Ticket no activo. Estado actual: ${booking.status}.`,
        booking
      };
    }

    const usedAt = new Date().toISOString();
    const validatedBooking: BookingRecord = {
      ...booking,
      status: 'used',
      usedAt
    };
    const nextHistory = this.historySubject.value.map((item) =>
      item.id === booking.id ? validatedBooking : item
    );

    this.historySubject.next(nextHistory);
    this.storage.setItem(this.historyKey, nextHistory);

    return {
      status: 'valid',
      message: 'Acceso autorizado. El ticket quedo marcado como utilizado.',
      booking: validatedBooking
    };
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

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private markSeatsAsSold(eventId: string, seatIds: string[]): void {
    const soldIds = new Set(this.storage.getItem<string[]>(this.soldSeatsKey, []));
    seatIds.forEach((seatId) => soldIds.add(this.getSeatStorageKey(eventId, seatId)));
    this.storage.setItem(this.soldSeatsKey, [...soldIds]);
  }

  private getSeatStorageKey(eventId: string, seatId: string): string {
    return `${eventId}:${seatId}`;
  }

  private persistConfirmedBooking(eventId: string, confirmedBooking: BookingRecord): void {
    const nextHistory = [confirmedBooking, ...this.historySubject.value.filter((item) => item.id !== confirmedBooking.id)];

    this.markSeatsAsSold(eventId, confirmedBooking.seats.map((seat) => seat.id));
    this.historySubject.next(nextHistory);
    this.currentBookingSubject.next(confirmedBooking);
    this.storage.setItem(this.historyKey, nextHistory);
    this.storage.setItem(this.currentBookingKey, confirmedBooking);
    this.pendingApiBooking = null;
    this.persistCart({
      eventId,
      seats: [],
      holdExpiresAt: null
    });
    this.notifications.success('Compra confirmada. Ticket generado.');
  }

  private mapLaravelSeatMap(eventId: string, apiSections: LaravelSeatMapSection[]): SeatMap {
    const activeEvent = this.activeEventSubject.value;
    const validApiSections = apiSections.filter((sec) => sec.seats && sec.seats.length > 0);
    const targetSections = validApiSections.length > 0 ? validApiSections : apiSections;

    const allApiSeats: LaravelSeat[] = targetSections.flatMap((s) => s.seats);
    const sectionNamesById = new Map<string, string>();
    targetSections.forEach((section) => {
      if (section.section_id != null && section.section) {
        sectionNamesById.set(String(section.section_id), section.section);
      }
    });
    const tableGroupMap = new Map<number, LaravelSeat[]>();

    allApiSeats.forEach((seat, idx) => {
      let tNum = Number(seat.number_table);
      if (!Number.isFinite(tNum) || tNum < 1) {
        tNum = Math.floor(idx / 10) + 1;
      }
      const list = tableGroupMap.get(tNum) ?? [];
      list.push({ ...seat, number_table: tNum });
      tableGroupMap.set(tNum, list);
    });

    const sections: SeatSection[] = targetSections.map((apiSection) => {
      const sectionName = apiSection.section || 'General';
      const sectionId = this.slugify(sectionName);
      const mappedSeats = apiSection.seats.map((seat, seatIndex) =>
        this.mapLaravelSeat(seat, sectionId, sectionName, 0, seatIndex)
      );
      const prices = mappedSeats.map((seat) => seat.price);

      return {
        id: sectionId,
        name: sectionName,
        color: sectionId.includes('vip') ? '#e85d04' : sectionId.includes('diamante') ? '#0b2c6b' : '#008c95',
        polygon: '',
        labelX: 90,
        labelY: 180,
        seats: mappedSeats,
        priceFrom: prices.length > 0 ? Math.min(...prices) : 0
      };
    });

    const tables: SeatTable[] = Array.from(tableGroupMap.entries()).map(([tableNumber, apiTableSeats]) => {
      const first = apiTableSeats[0];
      const sectionName = first?.section
        || (first?.section_id != null ? sectionNamesById.get(String(first.section_id)) : undefined)
        || 'General';
      const sectionId = this.slugify(sectionName);
      const position = calculateTablePosition(tableNumber, sectionName);

      const tableSeats = apiTableSeats.map((s, idx) => {
        const sNum = this.tableSeatNumber(s, idx + 1);
        const localPos = calculateLocalSeatPosition(sNum);
        const mapped = this.mapLaravelSeat(s, sectionId, sectionName, 0, idx);
        return {
          ...mapped,
          tableId: `table-${tableNumber}`,
          tableLabel: String(tableNumber),
          x: position.x + localPos.cx,
          y: position.y + localPos.cy
        };
      });

      return {
        id: `table-${tableNumber}`,
        label: String(tableNumber),
        sectionId,
        sectionName,
        x: position.x,
        y: position.y,
        width: 32,
        height: 78,
        seats: tableSeats
      };
    });

    return {
      eventId,
      venueName: activeEvent?.venueName ?? 'Venue',
      width: 1900,
      height: 2120,
      minScale: 0.4,
      maxScale: 2.5,
      stage: {
        x: 460,
        y: 20,
        width: 980,
        height: 90,
        label: 'ESCENARIO'
      },
      sections,
      tables
    };
  }

  private mapLaravelSeat(
    seat: LaravelSeat,
    sectionId: string,
    sectionName: string,
    sectionIndex: number,
    seatIndex: number
  ): Seat {
    const rowIndex = Math.floor(seatIndex / 10);
    const colIndex = seatIndex % 10;
    const apiPrice = Number(seat.price);
    const price = Number.isFinite(apiPrice) && apiPrice >= 0 ? apiPrice : this.getSectionPrice(sectionName);
    const row = seat.row ?? seat.row_label ?? 'A';
    const number = this.tableSeatNumber(seat, seatIndex + 1);

    return {
      id: String(seat.id),
      row,
      number,
      label: seat.label ?? `${row}-${number}`,
      section: sectionName,
      sectionId,
      price,
      status: this.mapSeatStatus(seat.state ?? seat.status),
      x: 105 + colIndex * 42,
      y: 210 + sectionIndex * 250 + rowIndex * 42,
      radius: 16
    };
  }

  private getSectionPrice(sectionName: string): number {
    const event = this.activeEventSubject.value;
    const tier = event?.priceTiers.find((item) => item.name.toLowerCase() === sectionName.toLowerCase());

    return tier?.price ?? event?.basePrice ?? 0;
  }

  private tableSeatNumber(seat: LaravelSeat, fallback: number): number {
    const rawNumber = Number(seat.number ?? seat.seat_number ?? fallback);
    if (!Number.isFinite(rawNumber) || rawNumber < 1) return fallback;
    return seat.number_table != null && String(seat.number_table).trim() !== ''
      ? ((Math.trunc(rawNumber) - 1) % 10) + 1
      : Math.trunc(rawNumber);
  }

  private mapSeatStatus(status?: string): Seat['status'] {
    if (status === 'reservado' || status === 'reserved') return 'reserved';
    if (
      status === 'vendido' ||
      status === 'sold' ||
      status === 'cortesia' ||
      status === 'bloqueado'
    ) return 'sold';
    if (status === 'selected') return 'selected';
    return 'available';
  }

  private groupSeatsByRow(seats: Seat[]): Map<string, Seat[]> {
    return seats.reduce((rows, seat) => {
      rows.set(seat.row, [...(rows.get(seat.row) ?? []), seat]);
      return rows;
    }, new Map<string, Seat[]>());
  }

  private mapLaravelBooking(booking: LaravelBooking): BookingRecord {
    const seats = (booking.seats ?? []).map((seat, index) => this.mapLaravelSeat(seat, this.slugify(seat.section), seat.section, 0, index));
    const event = booking.event;
    const total = Number(booking.total) || 0;

    return {
      id: String(booking.id),
      orderNumber: booking.reference,
      eventId: String(event?.id ?? this.cartSubject.value.eventId ?? ''),
      eventName: event?.title ?? this.activeEventSubject.value?.name ?? 'Evento',
      eventImage: this.activeEventSubject.value?.pdfImage ?? event?.image_url ?? this.activeEventSubject.value?.image ?? null,
      eventDate: event?.starts_at ?? this.activeEventSubject.value?.date ?? new Date().toISOString(),
      venueName: event?.venue?.name ?? this.activeEventSubject.value?.venueName ?? 'Venue',
      seats,
      totals: {
        subtotal: total,
        serviceFee: 0,
        taxes: 0,
        total
      },
      createdAt: booking.created_at ?? booking.confirmed_at ?? new Date().toISOString(),
      paymentMethod: booking.payment_method ?? booking.payments?.[0]?.provider ?? 'Sin método',
      status: this.mapBookingStatus(booking.status),
      qrCode: booking.tickets?.[0]?.qr_code ?? createSecureTicketQr(),
      usedAt: booking.tickets?.[0]?.used_at ?? null
    };
  }

  private mapLaravelBookingSummary(summary: LaravelBookingSummary): BookingRecord {
    const seats = summary.tickets.map((ticket, index) => {
      const [row, rawNumber] = ticket.seat.split('-');
      const sectionName = ticket.section || 'General';

      return this.mapLaravelSeat(
        {
          id: ticket.ticket_id,
          section: sectionName,
          row,
          number: Number(rawNumber) || index + 1,
          label: ticket.seat,
          price: Number(summary.booking.total) / Math.max(summary.tickets.length, 1),
          state: 'sold'
        },
        this.slugify(sectionName),
        sectionName,
        0,
        index
      );
    });

    const total = Number(summary.booking.total) || this.getTotals(seats).total;

    return {
      id: String(summary.booking.id),
      orderNumber: summary.booking.reference,
      eventId: String(summary.event.id),
      eventName: summary.event.title,
      eventImage: this.activeEventSubject.value?.pdfImage ?? summary.event.image_url ?? this.activeEventSubject.value?.image ?? null,
      eventDate: summary.event.date ?? new Date().toISOString(),
      venueName: this.activeEventSubject.value?.venueName ?? 'Venue',
      seats,
      totals: {
        subtotal: total,
        serviceFee: 0,
        taxes: 0,
        total
      },
      createdAt: new Date().toISOString(),
      paymentMethod: 'efectivo',
      status: 'confirmed',
      qrCode: summary.tickets[0]?.qr_code ?? createSecureTicketQr(),
      usedAt: null
    };
  }

  private mapLaravelTicket(ticket: LaravelTicket): BookingRecord {
    const seat = ticket.seat ? this.mapLaravelSeat(ticket.seat, this.slugify(ticket.seat.section), ticket.seat.section, 0, 0) : undefined;

    return {
      id: String(ticket.id),
      orderNumber: ticket.booking_reference ?? `TICKET-${ticket.id}`,
      eventId: String(ticket.event?.id ?? ''),
      eventName: ticket.event?.title ?? 'Evento',
      eventImage: ticket.event?.image_url ?? null,
      eventDate: ticket.event?.starts_at ?? ticket.issued_at ?? new Date().toISOString(),
      venueName: ticket.event?.venue ?? 'Venue',
      seats: seat ? [seat] : [],
      totals: this.getTotals(seat ? [seat] : []),
      createdAt: ticket.issued_at ?? new Date().toISOString(),
      paymentMethod: 'stripe',
      status: ticket.status === 'used' ? 'used' : ticket.status === 'issued' ? 'confirmed' : 'pending',
      qrCode: ticket.qr_code ?? createSecureTicketQr(),
      usedAt: ticket.used_at
    };
  }

  private mapBookingStatus(status: LaravelBooking['status']): BookingRecord['status'] {
    if (status === 'confirmed' || status === 'pagado') return 'confirmed';
    if (
      status === 'cancelled' ||
      status === 'cancelado' ||
      status === 'expired' ||
      status === 'expirado'
    ) return 'cancelled';
    return 'pending';
  }

  private looksLikeApiQrCode(payload: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload);
  }

  private migrateInsecureLocalTickets(): void {
    const history = this.historySubject.value;
    let changed = false;
    const migratedHistory = history.map((booking) => {
      if (parseSecureTicketQr(booking.qrCode) || this.looksLikeApiQrCode(booking.qrCode)) {
        return booking;
      }

      changed = true;
      return {
        ...booking,
        qrCode: createSecureTicketQr()
      };
    });

    if (!changed) {
      return;
    }

    const currentBooking = this.currentBookingSubject.value;
    const migratedCurrentBooking = currentBooking
      ? migratedHistory.find((booking) => booking.id === currentBooking.id) ?? currentBooking
      : null;

    this.historySubject.next(migratedHistory);
    this.currentBookingSubject.next(migratedCurrentBooking);
    this.storage.setItem(this.historyKey, migratedHistory);
    this.storage.setItem(this.currentBookingKey, migratedCurrentBooking);
  }

  private formatValidationDate(value: string): string {
    return new Intl.DateTimeFormat('es-GT', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }
}

interface LaravelSeat {
  id: number | string;
  section_id?: number | string;
  section: string;
  row?: string;
  row_label?: string;
  number?: number | string;
  seat_number?: number | string;
  number_table?: number | string;
  x?: number;
  y?: number;
  label?: string;
  price?: number | string;
  state?: Seat['status'] | 'disponible' | 'reservado' | 'vendido' | 'cortesia' | 'bloqueado';
  status?: Seat['status'] | 'disponible' | 'reservado' | 'vendido' | 'cortesia' | 'bloqueado';
}

interface LaravelSeatMapSection {
  section_id?: number | string;
  section: string | null;
  seats: LaravelSeat[];
}

interface LaravelBookingReservation {
  success?: boolean;
  booking_id: number | string;
  reference: string;
  total: number | string;
  expires_at: string;
}

interface LaravelBooking {
  id: number | string;
  reference: string;
  status: 'reserved' | 'confirmed' | 'cancelled' | 'expired' | 'reservado' | 'pagado' | 'cancelado' | 'expirado';
  total: number | string;
  payment_method?: string | null;
  created_at?: string | null;
  reserved_until?: string | null;
  confirmed_at?: string | null;
  event?: {
    id: number | string;
    title: string;
    starts_at?: string | null;
    image_url?: string | null;
    venue?: {
      name?: string | null;
    } | null;
  } | null;
  seats?: LaravelSeat[];
  payments?: LaravelPayment[];
  tickets?: LaravelTicket[];
}

interface LaravelPayment {
  id: number | string;
  provider: string;
  provider_reference?: string;
  amount: number | string;
  status: 'paid' | 'pending' | 'failed';
  paid_at?: string | null;
}

interface LaravelPaymentResponse {
  success: boolean;
  message?: string;
  booking_id?: number | string;
  payment_id?: number | string;
  tickets_count?: number;
}

interface ManualPaymentDetails {
  customerEmail: string;
  paymentMethod: 'efectivo' | 'visalink' | 'compraclic' | 'transferencia';
  authorizationNumber: string;
  proofFile: File | null;
}

interface LaravelBookingSummary {
  booking: {
    id: number | string;
    reference: string;
    status: string;
    total: number | string;
  };
  event: {
    id: number | string;
    title: string;
    date?: string | null;
    image_url?: string | null;
  };
  customer: {
    id: number | string;
    name: string;
    email: string;
  };
  invoice: unknown;
  tickets: Array<{
    ticket_id: number | string;
    qr_code: string;
    seat: string;
    section: string;
  }>;
}

interface LaravelTicket {
  id: number | string;
  qr_code?: string | null;
  status: 'issued' | 'used' | 'cancelled';
  issued_at?: string | null;
  used_at?: string | null;
  booking_reference?: string | null;
  event?: {
    id?: number | string;
    title?: string | null;
    starts_at?: string | null;
    image_url?: string | null;
    venue?: string | null;
  } | null;
  seat?: LaravelSeat;
}

function calculateTablePosition(tableNumber: number, sectionName?: string): { x: number; y: number } {
  const name = (sectionName || '').toUpperCase();
  const isGeneralOnly = name.includes('GENERAL') && tableNumber <= 15;

  if (isGeneralOnly) {
    const centerX = 934;
    const centerY = 170 + (tableNumber - 1) * 145;
    return { x: centerX - 16, y: centerY - 39 };
  }

  let sectionIndex: number;
  let globalRow: number;

  if (tableNumber <= 100) {
    sectionIndex = tableNumber - 1;
    globalRow = Math.floor(sectionIndex / 20);
  } else if (tableNumber <= 180) {
    sectionIndex = tableNumber - 101;
    globalRow = Math.floor(sectionIndex / 20) + 5;
  } else {
    sectionIndex = tableNumber - 181;
    globalRow = Math.floor(sectionIndex / 20) + 9;
  }

  const columnIndex = sectionIndex % 20;
  const centerX = 150 + columnIndex * 95;

  let centerY: number;
  if (globalRow < 5) {
    centerY = 170 + globalRow * 145;
  } else if (globalRow < 9) {
    centerY = 980 + (globalRow - 5) * 145;
  } else {
    centerY = 1660 + (globalRow - 9) * 145;
  }

  return {
    x: centerX - 16,
    y: centerY - 39
  };
}

function calculateLocalSeatPosition(seatNumber: number): { cx: number; cy: number } {
  const norm = Math.min(10, Math.max(1, Math.trunc(seatNumber)));
  if (norm <= 5) {
    return { cx: -10, cy: 11 + (norm - 1) * 14 };
  }
  return { cx: 42, cy: 11 + (norm - 6) * 14 };
}
