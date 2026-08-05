export type AdminBookingStatus =
  | 'pendiente'
  | 'reservado'
  | 'proceso_pago'
  | 'confirmado'
  | 'pagado'
  | 'cancelado'
  | 'expirado';

export interface AdminBooking {
  id: number;
  reference: string;
  status: AdminBookingStatus;
  total: number;
  created_at: string | null;
  reserved_until: string | null;
  confirmed_at: string | null;
  can_release: boolean;
  release_block_reason: string | null;
  customer_phone?: string | null;
  phone?: string | null;
  telefono?: string | null;
  customer?: {
    id: number | null;
    name: string | null;
    email: string | null;
    phone?: string | null;
    telefono?: string | null;
    customer_phone?: string | null;
  };
  event?: {
    id: number;
    title: string;
  };
  seats: AdminBookingSeat[];
  payments: unknown[];
  tickets: unknown[];
}

export interface AdminBookingSeat {
  id: number;
  section_id: number;
  section: string | null;
  row_label: string | null;
  seat_number: string;
  raw_seat_number: string;
  number_table: string | null;
}

export interface AdminBookingFilters {
  status: AdminBookingStatus | '';
  event_id: string;
  search: string;
  date_from: string;
  date_to: string;
  page: number;
  per_page: number;
}

export interface AdminBookingPage {
  data: AdminBooking[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}
