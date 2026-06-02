export type Booking = {
  id: string;
  service: string;
  styleId?: string;
  date: string;
  amount: number;
  hairType: string;
  status: 'completed' | 'upcoming' | 'cancelled';
};

export type FavoriteOrder = {
  service: string;
  count: number;
};

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  memberSince: string;
  totalSpent: number;
  totalBookings: number;
  hairTypes: string[];
  notes: string;
  favoriteOrders: FavoriteOrder[];
  pastBookings: Booking[];
};

export const CLIENTS: Client[] = [
  {
    id: '1',
    name: 'Aaliyah Johnson',
    email: 'aaliyah.johnson@email.com',
    phone: '(860) 555-0142',
    location: 'Norwich, CT',
    memberSince: 'Jan 2024',
    totalSpent: 1620,
    totalBookings: 12,
    hairTypes: ['4C Natural', 'Relaxed'],
    notes: 'Prefers afternoon slots. Loves intricate designs. Always tips well.',
    favoriteOrders: [
      { service: 'Fulani Braids', count: 5 },
      { service: 'Boho Braids', count: 4 },
      { service: 'Knotless Braids', count: 3 },
    ],
    pastBookings: [
      {
        id: 'b1',
        service: 'Fulani Braids',
        date: 'May 24, 2026',
        amount: 180,
        hairType: '4C Natural',
        status: 'upcoming',
      },
      {
        id: 'b2',
        service: 'Boho Braids',
        date: 'May 10, 2026',
        amount: 220,
        hairType: '4C Natural',
        status: 'completed',
      },
      {
        id: 'b3',
        service: 'Knotless Braids',
        date: 'Apr 22, 2026',
        amount: 160,
        hairType: '4C Natural',
        status: 'completed',
      },
      {
        id: 'b4',
        service: 'Wig Install',
        date: 'Mar 15, 2026',
        amount: 120,
        hairType: 'Relaxed',
        status: 'completed',
      },
    ],
  },
  {
    id: '2',
    name: 'Destiny Williams',
    email: 'destiny.williams@email.com',
    phone: '(860) 555-0198',
    location: 'New London, CT',
    memberSince: 'Aug 2024',
    totalSpent: 840,
    totalBookings: 7,
    hairTypes: ['3B Curly'],
    notes: 'Books every 3–4 weeks. Prefers medium-length styles.',
    favoriteOrders: [
      { service: 'Quick Weave', count: 4 },
      { service: 'French Braids', count: 2 },
      { service: 'Boho Braids', count: 1 },
    ],
    pastBookings: [
      {
        id: 'b5',
        service: 'Quick Weave',
        date: 'May 18, 2026',
        amount: 130,
        hairType: '3B Curly',
        status: 'completed',
      },
      {
        id: 'b6',
        service: 'French Braids',
        date: 'Apr 30, 2026',
        amount: 90,
        hairType: '3B Curly',
        status: 'completed',
      },
    ],
  },
  {
    id: '3',
    name: 'Janae Thompson',
    email: 'janae.thompson@email.com',
    phone: '(959) 555-0117',
    location: 'Groton, CT',
    memberSince: 'Nov 2025',
    totalSpent: 490,
    totalBookings: 4,
    hairTypes: ['4B Natural', 'Heat Styled'],
    notes: 'Always brings reference photos. Very detail-oriented.',
    favoriteOrders: [
      { service: 'Strawberry Shortcake Braids', count: 2 },
      { service: 'Knotless Braids', count: 2 },
    ],
    pastBookings: [
      {
        id: 'b7',
        service: 'Strawberry Shortcake Braids',
        date: 'May 5, 2026',
        amount: 200,
        hairType: '4B Natural',
        status: 'completed',
      },
      {
        id: 'b8',
        service: 'Knotless Braids',
        date: 'Apr 12, 2026',
        amount: 150,
        hairType: '4B Natural',
        status: 'completed',
      },
    ],
  },
  {
    id: '4',
    name: 'Brianna Scott',
    email: 'brianna.scott@email.com',
    phone: '(860) 555-0163',
    location: 'Waterford, CT',
    memberSince: 'Feb 2026',
    totalSpent: 210,
    totalBookings: 2,
    hairTypes: ['2C Wavy'],
    notes: 'New client. Referred by Destiny Williams.',
    favoriteOrders: [{ service: 'Quick Weave', count: 2 }],
    pastBookings: [
      {
        id: 'b9',
        service: 'Quick Weave',
        date: 'May 20, 2026',
        amount: 130,
        hairType: '2C Wavy',
        status: 'completed',
      },
      {
        id: 'b10',
        service: 'Quick Weave',
        date: 'Apr 28, 2026',
        amount: 80,
        hairType: '2C Wavy',
        status: 'cancelled',
      },
    ],
  },
];

export function getClientById(clientId: string) {
  return CLIENTS.find((client) => client.id === clientId);
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function formatCurrency(amount: number) {
  return `$${amount.toLocaleString()}`;
}
