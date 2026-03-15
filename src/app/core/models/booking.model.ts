import { Seat } from './seat.model';

export interface BookingTotals {
  subtotal: number;
  serviceFee: number;
  taxes: number;
  total: number;
}

export interface BookingRecord {
  id: string;
  orderNumber: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  venueName: string;
  seats: Seat[];
  totals: BookingTotals;
  createdAt: string;
  paymentMethod: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  qrCode: string;
}
