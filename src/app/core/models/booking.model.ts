import { Seat } from './seat.model';

export interface BookingItem {
  id?: string;
  eventId: string;
  seats: Seat[];
  total: number;
  createdAt?: string;
}
