export interface Venue {
  id: number | string;
  name: string;
  address: string;
  city: string;
  country: string;
  status: 'active' | 'inactive';
  seatMapConfig?: Record<string, unknown> | null;
}

export interface VenueInput {
  name: string;
  address: string;
  city: string;
  country: string;
  status: 'active' | 'inactive';
  seat_map_config?: Record<string, unknown> | null;
}
