import { BookingRecord } from '../models/booking.model';
import { EventItem } from '../models/event.model';
import { SeatMap, SeatStatus } from '../models/seat.model';
import { User } from '../models/user.model';

const statusMatrix = (rowIndex: number, seatIndex: number): SeatStatus => {
  if ((rowIndex + seatIndex) % 13 === 0) {
    return 'sold';
  }

  if ((rowIndex * 3 + seatIndex) % 9 === 0) {
    return 'reserved';
  }

  return 'available';
};

const createSeatMap = (eventId: string, basePrice: number, venueName: string): SeatMap => ({
  eventId,
  venueName,
  stageLabel: 'Main Stage',
  rows: Array.from({ length: 8 }, (_, rowIndex) => {
    const rowLabel = String.fromCharCode(65 + rowIndex);

    return {
      label: rowLabel,
      seats: Array.from({ length: 12 }, (_, seatIndex) => {
        const number = seatIndex + 1;
        const section = rowIndex < 2 ? 'Front' : rowIndex < 5 ? 'Premium' : 'General';

        return {
          id: `${eventId}-${rowLabel}-${number}`,
          row: rowLabel,
          number,
          label: `${rowLabel}${number}`,
          section,
          price: basePrice + (rowIndex < 2 ? 180 : rowIndex < 5 ? 90 : 0),
          status: statusMatrix(rowIndex, seatIndex),
          accessibility: seatIndex === 0 || seatIndex === 11
        };
      })
    };
  })
});

export const MOCK_CURRENT_USER: User = {
  id: 'user-01',
  fullName: 'Andrea Morales',
  email: 'andrea@pulseevents.io',
  phone: '+502 5555-0198',
  city: 'Guatemala City',
  membershipTier: 'Prime'
};

export const MOCK_EVENTS: EventItem[] = [
  {
    id: 'evt-neo-night',
    slug: 'neo-night-live',
    name: 'Neo Night Live',
    category: 'Concert',
    city: 'Guatemala City',
    date: '2026-04-18T20:00:00.000Z',
    time: '8:00 PM',
    location: 'Explanada Cayala',
    venueName: 'Foro Central',
    address: 'Zona 16, Guatemala City',
    image:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80',
    bannerColor: '#0f62fe',
    basePrice: 320,
    description:
      'Una noche de pop electronico con produccion inmersiva, hospitality premium y zonas por localidad disenadas para un flujo rapido de compra.',
    shortDescription: 'Show electronico premium con experiencia inmersiva y venta por localidades.',
    featured: true,
    status: 'on-sale',
    tags: ['Live', 'Top Seller', 'Weekend'],
    metrics: {
      interested: 1240,
      ticketsLeft: 138,
      rating: 4.8
    },
    priceTiers: [
      { name: 'General', price: 320, description: 'Acceso general.', availability: 'available' },
      { name: 'Premium', price: 420, description: 'Vista preferencial.', availability: 'limited' },
      { name: 'VIP Lounge', price: 620, description: 'Ingreso prioritario y lounge.', availability: 'limited' }
    ]
  },
  {
    id: 'evt-tech-forum',
    slug: 'tech-future-forum',
    name: 'Tech Future Forum',
    category: 'Conference',
    city: 'Antigua Guatemala',
    date: '2026-05-07T15:00:00.000Z',
    time: '3:00 PM',
    location: 'Centro de Convenciones Antigua',
    venueName: 'Hall Innovation',
    address: '5a Avenida Norte, Antigua Guatemala',
    image:
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    bannerColor: '#1f6f5f',
    basePrice: 250,
    description:
      'Conferencia enfocada en producto digital, growth y automatizacion para equipos de alto rendimiento.',
    shortDescription: 'Encuentro para lideres de producto, growth y tecnologia.',
    featured: true,
    status: 'on-sale',
    tags: ['Business', 'Networking'],
    metrics: {
      interested: 860,
      ticketsLeft: 240,
      rating: 4.7
    },
    priceTiers: [
      { name: 'General', price: 250, description: 'Acceso al auditorio principal.', availability: 'available' },
      { name: 'Executive', price: 380, description: 'Acceso a workshops.', availability: 'available' },
      { name: 'Backstage', price: 520, description: 'Lounge y meetups privados.', availability: 'limited' }
    ]
  },
  {
    id: 'evt-rooftop-jazz',
    slug: 'rooftop-jazz-sessions',
    name: 'Rooftop Jazz Sessions',
    category: 'Live Session',
    city: 'Quetzaltenango',
    date: '2026-04-02T01:00:00.000Z',
    time: '7:00 PM',
    location: 'Terraza 360',
    venueName: 'Sky Hall',
    address: 'Zona 3, Quetzaltenango',
    image:
      'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80',
    bannerColor: '#e76f51',
    basePrice: 180,
    description:
      'Sesion intima con cupo reducido, cocteleria de autor y visuales calidos para una experiencia boutique.',
    shortDescription: 'Formato boutique con cupo limitado y experiencia premium.',
    featured: false,
    status: 'low-stock',
    tags: ['Boutique', 'Limited'],
    metrics: {
      interested: 420,
      ticketsLeft: 34,
      rating: 4.9
    },
    priceTiers: [
      { name: 'Mesa Alta', price: 180, description: 'Acceso general.', availability: 'limited' },
      { name: 'Front Lounge', price: 260, description: 'Vista frontal.', availability: 'limited' },
      { name: 'Private Booth', price: 390, description: 'Reservado para grupos.', availability: 'sold-out' }
    ]
  },
  {
    id: 'evt-food-market',
    slug: 'artisan-food-market',
    name: 'Artisan Food Market',
    category: 'Festival',
    city: 'Guatemala City',
    date: '2026-06-14T17:00:00.000Z',
    time: '11:00 AM',
    location: 'Parque Urbano',
    venueName: 'Open Grounds',
    address: 'Zona 14, Guatemala City',
    image:
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80',
    bannerColor: '#ff7f11',
    basePrice: 90,
    description:
      'Festival gastronomico con activaciones de marca, food trucks y tickets por franjas horarias.',
    shortDescription: 'Festival gastronomico con accesos por horarios y experiencias de marca.',
    featured: true,
    status: 'on-sale',
    tags: ['Family', 'Outdoor'],
    metrics: {
      interested: 1520,
      ticketsLeft: 540,
      rating: 4.6
    },
    priceTiers: [
      { name: 'Morning Pass', price: 90, description: 'Acceso de 11 AM a 3 PM.', availability: 'available' },
      { name: 'Sunset Pass', price: 120, description: 'Acceso de 3 PM a 8 PM.', availability: 'available' },
      { name: 'Full Day', price: 160, description: 'Acceso completo.', availability: 'available' }
    ]
  },
  {
    id: 'evt-design-summit',
    slug: 'design-summit-latam',
    name: 'Design Summit LATAM',
    category: 'Conference',
    city: 'Guatemala City',
    date: '2026-07-25T14:00:00.000Z',
    time: '9:00 AM',
    location: 'Distrito Creativo',
    venueName: 'Auditorio Vision',
    address: 'Zona 4, Guatemala City',
    image:
      'https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1200&q=80',
    bannerColor: '#264653',
    basePrice: 295,
    description:
      'Summit para equipos de UX/UI, branding y producto con workshops, keynote y networking guiado.',
    shortDescription: 'Evento especializado para diseno digital y liderazgo de producto.',
    featured: false,
    status: 'on-sale',
    tags: ['UX/UI', 'Workshop'],
    metrics: {
      interested: 710,
      ticketsLeft: 188,
      rating: 4.8
    },
    priceTiers: [
      { name: 'Standard', price: 295, description: 'Acceso a keynotes.', availability: 'available' },
      { name: 'Workshop', price: 425, description: 'Incluye talleres.', availability: 'limited' },
      { name: 'All Access', price: 560, description: 'Networking y after event.', availability: 'limited' }
    ]
  },
  {
    id: 'evt-cinema-premiere',
    slug: 'cinema-premiere-night',
    name: 'Cinema Premiere Night',
    category: 'Premiere',
    city: 'Escuintla',
    date: '2026-08-08T01:00:00.000Z',
    time: '7:30 PM',
    location: 'Cine Royal',
    venueName: 'Room Platinum',
    address: 'Centro Comercial Pacifico, Escuintla',
    image:
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80',
    bannerColor: '#6d597a',
    basePrice: 140,
    description:
      'Estreno exclusivo con seating numerado, experiencias VIP y emision de ticket digital con QR.',
    shortDescription: 'Premiere con seating numerado y extras VIP.',
    featured: false,
    status: 'on-sale',
    tags: ['Cinema', 'Premium'],
    metrics: {
      interested: 360,
      ticketsLeft: 92,
      rating: 4.5
    },
    priceTiers: [
      { name: 'Classic', price: 140, description: 'Butaca estandar.', availability: 'available' },
      { name: 'Platinum', price: 210, description: 'Butaca reclinable.', availability: 'limited' },
      { name: 'Director Box', price: 340, description: 'Suite privada.', availability: 'limited' }
    ]
  }
];

export const MOCK_SEAT_MAPS: Record<string, SeatMap> = Object.fromEntries(
  MOCK_EVENTS.map((event) => [event.id, createSeatMap(event.id, event.basePrice, event.venueName)])
);

export const MOCK_BOOKINGS: BookingRecord[] = [
  {
    id: 'booking-1001',
    orderNumber: 'PLS-240801',
    eventId: 'evt-neo-night',
    eventName: 'Neo Night Live',
    eventDate: '2026-04-18T20:00:00.000Z',
    venueName: 'Foro Central',
    seats: [
      {
        id: 'evt-neo-night-B-4',
        row: 'B',
        number: 4,
        label: 'B4',
        section: 'Premium',
        price: 410,
        status: 'selected'
      },
      {
        id: 'evt-neo-night-B-5',
        row: 'B',
        number: 5,
        label: 'B5',
        section: 'Premium',
        price: 410,
        status: 'selected'
      }
    ],
    totals: {
      subtotal: 820,
      serviceFee: 74,
      taxes: 42,
      total: 936
    },
    createdAt: '2026-03-01T18:25:00.000Z',
    paymentMethod: 'Visa ending in 4421',
    status: 'confirmed',
    qrCode: 'QR-PLS-240801'
  }
];
