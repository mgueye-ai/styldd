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
  styleId?: string;
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
