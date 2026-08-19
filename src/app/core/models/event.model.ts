export interface EventPriceTier {
  sectionId?: number | string;
  name: string;
  price: number;
  description: string;
  availability: 'available' | 'limited' | 'sold-out';
}

export interface EventMetrics {
  interested: number;
  ticketsLeft: number;
  rating: number;
}

export interface EventItem {
  id: string;
  venueId?: number | string;
  slug: string;
  name: string;
  category: string;
  city: string;
  date: string;
  time: string;
  location: string;
  venueName: string;
  address: string;
  image: string;
  pdfImage?: string;
  bannerColor: string;
  basePrice: number;
  description: string;
  shortDescription: string;
  featured: boolean;
  status: 'draft' | 'on-sale' | 'low-stock' | 'sold-out';
  tags: string[];
  metrics: EventMetrics;
  priceTiers: EventPriceTier[];
}

export interface EventFilters {
  query: string;
  category: string;
  city: string;
  datePreset: 'all' | 'today' | 'week' | 'month';
  priceRange: 'all' | 'budget' | 'premium';
}
