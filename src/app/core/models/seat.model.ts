export type SeatStatus = 'available' | 'reserved' | 'sold' | 'selected';

export interface Seat {
  id: string;
  row: string;
  number: number;
  price: number;
  status: SeatStatus;
}
