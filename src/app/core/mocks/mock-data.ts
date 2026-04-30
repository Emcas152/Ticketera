import { BookingRecord } from '../models/booking.model';
import { EventItem } from '../models/event.model';
import { Seat, SeatMap, SeatStatus, SeatTable } from '../models/seat.model';
import { User } from '../models/user.model';

const statusMatrix = (sectionId: string, tableIndex: number, seatIndex: number): SeatStatus => {
  if (sectionId === 'general' && seatIndex % 5 === 0) {
    return 'sold';
  }

  if (sectionId === 'occupied' || (sectionId === 'vip' && (tableIndex + seatIndex) % 6 === 0)) {
    return 'reserved';
  }

  if (sectionId === 'vip' && seatIndex < 2 && tableIndex % 3 === 0) {
    return 'available';
  }

  return 'available';
};

interface SectionConfig {
  id: string;
  name: string;
  color: string;
  price: number;
}

interface TableBlueprint {
  label: string;
  sectionId: string;
  x: number;
  y: number;
}

const createTable = (
  eventId: string,
  section: SectionConfig,
  blueprint: TableBlueprint,
  tableIndex: number
): SeatTable => {
  const width = 72;
  const height = 138;
  const seatOffset = 34;
  const seatSpacing = 28;
  const radius = 13;
  const seats: Seat[] = [];

  for (let seatIndex = 0; seatIndex < 8; seatIndex++) {
    const isLeft = seatIndex < 4;
    const localIndex = seatIndex % 4;
    const x = isLeft ? blueprint.x - seatOffset : blueprint.x + width + seatOffset;
    const y = blueprint.y + 24 + localIndex * seatSpacing;
    const number = seatIndex + 1;

    seats.push({
      id: `${eventId}-${section.id}-${blueprint.label}-${number}`,
      row: blueprint.label,
      number,
      label: `Mesa ${blueprint.label} - Asiento ${number}`,
      section: section.name,
      sectionId: section.id,
      tableId: `${section.id}-${blueprint.label}`,
      tableLabel: blueprint.label,
      price: section.price,
      status: statusMatrix(section.id, tableIndex, seatIndex),
      x,
      y,
      radius,
      accessibility: seatIndex === 0 || seatIndex === 4
    });
  }

  return {
    id: `${section.id}-${blueprint.label}`,
    label: blueprint.label,
    sectionId: section.id,
    sectionName: section.name,
    x: blueprint.x,
    y: blueprint.y,
    width,
    height,
    seats
  };
};

const createSeatMap = (eventId: string, basePrice: number, venueName: string): SeatMap => {
  const sectionConfigs: SectionConfig[] = [
    {
      id: 'vip',
      name: 'VIP',
      color: '#65ff00',
      price: basePrice + 550
    },
    {
      id: 'general',
      name: 'GENERAL',
      color: '#49a7ff',
      price: basePrice + 180
    },
    {
      id: 'occupied',
      name: 'OCUPADO',
      color: '#ff4b4b',
      price: basePrice + 180
    }
  ];

  const tableBlueprints: TableBlueprint[] = [
    { sectionId: 'occupied', label: '1', x: 110, y: 160 },
    { sectionId: 'occupied', label: '2', x: 250, y: 160 },
    { sectionId: 'occupied', label: '3', x: 390, y: 160 },
    { sectionId: 'occupied', label: '4', x: 530, y: 160 },
    { sectionId: 'occupied', label: '5', x: 670, y: 160 },
    { sectionId: 'occupied', label: '6', x: 810, y: 160 },
    { sectionId: 'vip', label: '7', x: 950, y: 160 },
    { sectionId: 'vip', label: '58', x: 1080, y: 150 },
    { sectionId: 'vip', label: '57', x: 1080, y: 250 },
    { sectionId: 'occupied', label: '16', x: 110, y: 300 },
    { sectionId: 'occupied', label: '15', x: 250, y: 300 },
    { sectionId: 'occupied', label: '14', x: 390, y: 300 },
    { sectionId: 'occupied', label: '13', x: 530, y: 300 },
    { sectionId: 'occupied', label: '12', x: 670, y: 300 },
    { sectionId: 'occupied', label: '11', x: 810, y: 300 },
    { sectionId: 'occupied', label: '10', x: 950, y: 300 },
    { sectionId: 'occupied', label: '17', x: 110, y: 470 },
    { sectionId: 'occupied', label: '18', x: 250, y: 470 },
    { sectionId: 'occupied', label: '19', x: 390, y: 470 },
    { sectionId: 'occupied', label: '20', x: 530, y: 470 },
    { sectionId: 'occupied', label: '21', x: 670, y: 470 },
    { sectionId: 'occupied', label: '22', x: 810, y: 470 },
    { sectionId: 'occupied', label: '23', x: 950, y: 470 },
    { sectionId: 'occupied', label: '30', x: 110, y: 640 },
    { sectionId: 'vip', label: '29', x: 250, y: 640 },
    { sectionId: 'occupied', label: '28', x: 390, y: 640 },
    { sectionId: 'occupied', label: '27', x: 530, y: 640 },
    { sectionId: 'occupied', label: '26', x: 670, y: 640 },
    { sectionId: 'occupied', label: '25', x: 810, y: 640 },
    { sectionId: 'occupied', label: '24', x: 950, y: 640 },
    { sectionId: 'occupied', label: '31', x: 330, y: 810 },
    { sectionId: 'occupied', label: '32', x: 470, y: 810 },
    { sectionId: 'occupied', label: '33', x: 610, y: 810 },
    { sectionId: 'occupied', label: '34', x: 750, y: 810 },
    { sectionId: 'occupied', label: '35', x: 890, y: 810 },
    { sectionId: 'general', label: '40', x: 330, y: 980 },
    { sectionId: 'occupied', label: '39', x: 470, y: 980 },
    { sectionId: 'occupied', label: '38', x: 610, y: 980 },
    { sectionId: 'general', label: '37', x: 750, y: 980 },
    { sectionId: 'general', label: '36', x: 890, y: 980 },
    { sectionId: 'occupied', label: '41', x: 330, y: 1140 },
    { sectionId: 'general', label: '46', x: 180, y: 1380 },
    { sectionId: 'general', label: '47', x: 320, y: 1380 },
    { sectionId: 'general', label: '49', x: 180, y: 1550 },
    { sectionId: 'general', label: '48', x: 320, y: 1550 },
    { sectionId: 'general', label: '50', x: 180, y: 1720 }
  ];

  const tables = tableBlueprints.map((blueprint, tableIndex) => {
    const section = sectionConfigs.find((item) => item.id === blueprint.sectionId)!;
    return createTable(eventId, section, blueprint, tableIndex);
  });

  const sections = sectionConfigs.map((section) => {
    const sectionTables = tables.filter((table) => table.sectionId === section.id);
    const seats = sectionTables.flatMap((table) => table.seats);
    const minX = Math.min(...sectionTables.map((table) => table.x - 58));
    const maxX = Math.max(...sectionTables.map((table) => table.x + table.width + 58));
    const minY = Math.min(...sectionTables.map((table) => table.y - 44));
    const maxY = Math.max(...sectionTables.map((table) => table.y + table.height + 44));
    const polygon = `${minX},${maxY} ${minX},${minY} ${maxX},${minY} ${maxX},${maxY}`;

    return {
      id: section.id,
      name: section.name,
      color: section.color,
      polygon,
      labelX: (minX + maxX) / 2,
      labelY: minY + 18,
      seats,
      priceFrom: section.price
    };
  });

  return {
    eventId,
    venueName,
    width: 1520,
    height: 1880,
    minScale: 0.42,
    maxScale: 3.1,
    stage: {
      x: 160,
      y: 36,
      width: 920,
      height: 120,
      label: 'ESCENARIO',
      subtitle: venueName,
      theme: 'ornate'
    },
    sections,
    tables,
    lanes: [
      {
        id: 'vip-lane',
        label: 'VIP',
        x: 0,
        y: 165,
        width: 34,
        height: 690,
        fill: '#65ff00',
        textColor: '#10210a'
      },
      {
        id: 'general-lane',
        label: 'GENERAL',
        x: 0,
        y: 900,
        width: 34,
        height: 870,
        fill: '#49a7ff',
        textColor: '#08223d'
      }
    ],
    amenities: [
      {
        id: 'bathroom',
        label: 'BAÑOS',
        x: 1040,
        y: 610,
        width: 180,
        height: 240,
        fill: '#70727c',
        textColor: '#ffffff'
      }
    ],
    badges: [
      { id: 'b53', label: '53', x: 54, y: 248, rotation: -28 },
      { id: 'b54', label: '54', x: 54, y: 424, rotation: -28 },
      { id: 'b55', label: '55', x: 54, y: 599, rotation: -28 },
      { id: 'b56', label: '56', x: 54, y: 773, rotation: -28 },
      { id: 'b42', label: '42', x: 495, y: 1268, rotation: 30 },
      { id: 'b43', label: '43', x: 715, y: 1268, rotation: 18 },
      { id: 'b44', label: '44', x: 920, y: 1268, rotation: 18 },
      { id: 'b59', label: '59', x: 1220, y: 310, rotation: -40 },
      { id: 'b60', label: '60', x: 1230, y: 185, rotation: -40 }
    ],
    poster: {
      title: eventId === 'evt-rooftop-jazz' ? 'Rooftop Jazz' : 'Café Escenario',
      subtitle: eventId === 'evt-rooftop-jazz' ? 'Live Session' : 'Music chill & Coffee',
      lines: ['JUEVES', '12 FEBRERO', 'ABIERTO DESDE LAS 7PM', 'VIP: Q.150', 'GENERAL: Q.100'],
      x: 1235,
      y: 0,
      width: 285,
      height: 1880,
      fill: '#8e0909'
    },
    entrance: {
      label: 'INGRESO',
      x: 845,
      y: 1600,
      direction: 'left'
    }
  };
};

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
    bannerColor: '#004489',
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
    bannerColor: '#004489',
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
    bannerColor: '#BA1C1C',
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
    bannerColor: '#BA1C1C',
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
    bannerColor: '#004489',
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
    bannerColor: '#BA1C1C',
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
        id: 'evt-neo-night-vip-VB-4',
        row: 'VB',
        number: 4,
        label: 'VB4',
        section: 'VIP Center',
        sectionId: 'vip',
        price: 560,
        status: 'selected',
        x: 560,
        y: 226,
        radius: 11
      },
      {
        id: 'evt-neo-night-vip-VB-5',
        row: 'VB',
        number: 5,
        label: 'VB5',
        section: 'VIP Center',
        sectionId: 'vip',
        price: 560,
        status: 'selected',
        x: 588,
        y: 226,
        radius: 11
      }
    ],
    totals: {
      subtotal: 1120,
      serviceFee: 101,
      taxes: 56,
      total: 1277
    },
    createdAt: '2026-03-01T18:25:00.000Z',
    paymentMethod: 'Visa ending in 4421',
    status: 'confirmed',
    qrCode: 'QR-PLS-240801'
  }
];
