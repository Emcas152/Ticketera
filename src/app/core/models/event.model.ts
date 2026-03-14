export interface EventItem {
  id: string;
  name: string;
  date: string; // ISO
  location: string;
  image?: string;
  basePrice: number;
  description?: string;
}
