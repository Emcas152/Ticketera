export type SeatStatus = 'available' | 'reserved' | 'sold' | 'selected';

export interface Seat {
  id: string;
  row: string;
  number: number;
  label: string;
  section: string;
  price: number;
  status: SeatStatus;
  accessibility?: boolean;
}

export interface SeatRow {
  label: string;
  seats: Seat[];
}

export interface SeatMap {
  eventId: string;
  venueName: string;
  stageLabel: string;
  rows: SeatRow[];
}
