export type SeatStatus = 'available' | 'reserved' | 'sold' | 'selected';

export interface Seat {
  id: string;
  row: string;
  number: number;
  label: string;
  section: string;
  sectionId: string;
  tableId?: string;
  tableLabel?: string;
  price: number;
  status: SeatStatus;
  x: number;
  y: number;
  radius: number;
  accessibility?: boolean;
}

export interface SeatTable {
  id: string;
  label: string;
  sectionId: string;
  sectionName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  seats: Seat[];
}

export interface SeatSection {
  id: string;
  name: string;
  color: string;
  polygon: string;
  labelX: number;
  labelY: number;
  seats: Seat[];
  priceFrom: number;
}

export interface SeatStage {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  subtitle?: string;
  theme?: 'default' | 'ornate';
}

export interface SeatMapAmenity {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  textColor?: string;
}

export interface SeatMapBadge {
  id: string;
  label: string;
  x: number;
  y: number;
  rotation?: number;
}

export interface SeatMapLane {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  textColor?: string;
}

export interface SeatMapPoster {
  title: string;
  subtitle?: string;
  lines: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
}

export interface SeatMapEntrance {
  label: string;
  x: number;
  y: number;
  direction: 'left' | 'right' | 'up' | 'down';
}

export interface SeatMap {
  eventId: string;
  venueName: string;
  width: number;
  height: number;
  minScale: number;
  maxScale: number;
  stage: SeatStage;
  sections: SeatSection[];
  tables: SeatTable[];
  amenities?: SeatMapAmenity[];
  badges?: SeatMapBadge[];
  lanes?: SeatMapLane[];
  poster?: SeatMapPoster;
  entrance?: SeatMapEntrance;
}
