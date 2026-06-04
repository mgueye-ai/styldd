import { AppointmentDetail } from '../data/appointments';
import { Booking, Client, FavoriteOrder } from '../data/clients';
import { CalendarEvent } from '../data/calendarEvents';
import { Period } from '../data/periods';
import {
  createLinkedSiteClient,
  fetchLinkedSite,
  getLinkedSiteLabel,
  getLinkedTableName,
  LinkedSite,
} from './linkedSites';

type UnifiedSiteRecord = {
  id: string;
  record_type: string;
  record_key: string | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type FlatBookingRecord = Record<string, unknown> & {
  id: string;
  full_name?: string;
  created_at?: string;
};

export type SiteBookingRecord = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  service: string;
  styleId: string;
  hairType: string;
  notes: string;
  location: string;
  price: number;
  depositAmount: number;
  depositPaid: boolean;
  bookingStatus: string;
  startsAt: Date | null;
  durationMinutes: number;
  createdAt: Date;
};

export type SiteDataSnapshot = {
  linkedSite: LinkedSite | null;
  bookings: SiteBookingRecord[];
  appointments: AppointmentDetail[];
  clients: Client[];
  calendarEvents: CalendarEvent[];
};

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs && mins) return `${hrs} hr ${mins} min`;
  if (hrs) return `${hrs} hr${hrs > 1 ? 's' : ''}`;
  return `${mins} min`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('default', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatAppointmentDate(date: Date): string {
  const today = startOfDay(new Date());
  const target = startOfDay(date);

  if (target.getTime() === today.getTime()) {
    return `Today, ${date.toLocaleDateString('default', { month: 'short', day: 'numeric' })}`;
  }

  const tomorrow = addDays(today, 1);
  if (target.getTime() === tomorrow.getTime()) {
    return `Tomorrow, ${date.toLocaleDateString('default', { month: 'short', day: 'numeric' })}`;
  }

  return date.toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeRange(start: Date, durationMinutes: number): string {
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function mapBookingStatus(bookingStatus: string, startsAt: Date | null): AppointmentDetail['status'] {
  if (bookingStatus === 'cancelled') return 'cancelled';
  if (bookingStatus === 'completed') return 'completed';
  if (startsAt && startsAt.getTime() < Date.now()) return 'completed';
  return 'upcoming';
}

function mapClientBookingStatus(status: AppointmentDetail['status']): Booking['status'] {
  if (status === 'cancelled') return 'cancelled';
  if (status === 'completed') return 'completed';
  return 'upcoming';
}

function getClientKey(email: string, phone: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.replace(/\D/g, '');
  return normalizedEmail || normalizedPhone || 'unknown-client';
}

function isUnifiedRecord(row: unknown): row is UnifiedSiteRecord {
  return (
    typeof row === 'object' &&
    row !== null &&
    'record_type' in row &&
    'data' in row
  );
}

function parseUnifiedBooking(record: UnifiedSiteRecord): SiteBookingRecord | null {
  if (record.record_type !== 'booking') return null;

  const data = record.data ?? {};
  const startsAt =
    parseDate(data.appointment_starts_at) ??
    parseDate(data.appointment_date ? `${data.appointment_date}T12:00:00` : null);

  return {
    id: record.id,
    fullName: asString(data.full_name, 'Unknown client'),
    email: asString(data.email),
    phone: asString(data.phone),
    service: asString(data.style_name) || asString(data.style_id, 'Booking'),
    styleId: asString(data.style_id),
    hairType: [asString(data.hair_length), asString(data.hair_option)].filter(Boolean).join(' · ') || '—',
    notes: asString(data.notes),
    location: asString(data.service_address, 'Studio'),
    price: asNumber(data.estimated_total),
    depositAmount: asNumber(data.deposit_amount),
    depositPaid:
      asNumber(data.deposit_amount) > 0 &&
      !['pending', 'in_person'].includes(asString(data.payment_status)),
    bookingStatus: asString(data.booking_status, 'pending_payment'),
    startsAt,
    durationMinutes: asNumber(data.duration_minutes, 120),
    createdAt: parseDate(record.created_at) ?? new Date(),
  };
}

function parseFlatBooking(record: FlatBookingRecord): SiteBookingRecord | null {
  if (!record.full_name) return null;

  const startsAt =
    parseDate(record.appointment_starts_at) ??
    parseDate(record.appointment_date ? `${record.appointment_date}T12:00:00` : null);

  return {
    id: String(record.id),
    fullName: asString(record.full_name, 'Unknown client'),
    email: asString(record.email),
    phone: asString(record.phone),
    service: asString(record.style_name) || asString(record.style_id, 'Booking'),
    styleId: asString(record.style_id),
    hairType: [asString(record.hair_length), asString(record.hair_option)].filter(Boolean).join(' · ') || '—',
    notes: asString(record.notes),
    location: asString(record.service_address, 'Studio'),
    price: asNumber(record.estimated_total),
    depositAmount: asNumber(record.deposit_amount),
    depositPaid:
      asNumber(record.deposit_amount) > 0 &&
      !['pending', 'in_person'].includes(asString(record.payment_status)),
    bookingStatus: asString(record.booking_status, 'pending_payment'),
    startsAt,
    durationMinutes: asNumber(record.duration_minutes, 120),
    createdAt: parseDate(record.created_at) ?? new Date(),
  };
}

function normalizeBookingRecords(rows: unknown[]): SiteBookingRecord[] {
  if (rows.length === 0) return [];

  if (rows.every(isUnifiedRecord)) {
    return rows
      .map(parseUnifiedBooking)
      .filter((booking): booking is SiteBookingRecord => booking !== null);
  }

  return rows
    .map((row) => parseFlatBooking(row as FlatBookingRecord))
    .filter((booking): booking is SiteBookingRecord => booking !== null);
}

function toAppointmentDetail(booking: SiteBookingRecord): AppointmentDetail {
  const status = mapBookingStatus(booking.bookingStatus, booking.startsAt);
  const startsAt = booking.startsAt ?? booking.createdAt;

  return {
    id: booking.id,
    service: booking.service,
    styleId: booking.styleId || undefined,
    status,
    date: formatAppointmentDate(startsAt),
    time: booking.startsAt ? formatTimeRange(booking.startsAt, booking.durationMinutes) : 'Time TBD',
    duration: formatDuration(booking.durationMinutes),
    clientName: booking.fullName,
    clientPhone: booking.phone || '—',
    location: booking.location,
    price: booking.price,
    hairType: booking.hairType,
    notes: booking.notes || 'No notes added.',
    depositPaid: booking.depositPaid,
    depositAmount: booking.depositAmount,
  };
}

function toCalendarEvent(booking: SiteBookingRecord): CalendarEvent | null {
  if (!booking.startsAt) return null;
  const statusKey = booking.bookingStatus.toLowerCase();
  if (statusKey === 'cancelled' || statusKey === 'canceled') return null;

  const end = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60_000);
  const status = mapBookingStatus(booking.bookingStatus, booking.startsAt);

  return {
    id: `event-${booking.id}`,
    appointmentId: booking.id,
    title: booking.service,
    dateKey: toDateKey(booking.startsAt),
    startHour: booking.startsAt.getHours(),
    startMinute: booking.startsAt.getMinutes(),
    endHour: end.getHours(),
    endMinute: end.getMinutes(),
    completed: status === 'completed',
  };
}

function buildClients(bookings: SiteBookingRecord[]): Client[] {
  const grouped = new Map<string, SiteBookingRecord[]>();

  for (const booking of bookings) {
    const key = getClientKey(booking.email, booking.phone);
    const current = grouped.get(key) ?? [];
    current.push(booking);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .map(([key, clientBookings]) => {
      const sorted = [...clientBookings].sort((a, b) => {
        const aTime = (a.startsAt ?? a.createdAt).getTime();
        const bTime = (b.startsAt ?? b.createdAt).getTime();
        return bTime - aTime;
      });

      const latest = sorted[0];
      const completedBookings = sorted.filter(
        (booking) => mapBookingStatus(booking.bookingStatus, booking.startsAt) === 'completed',
      );

      const serviceCounts = new Map<string, number>();
      for (const booking of sorted) {
        serviceCounts.set(booking.service, (serviceCounts.get(booking.service) ?? 0) + 1);
      }

      const favoriteOrders: FavoriteOrder[] = Array.from(serviceCounts.entries())
        .map(([service, count]) => ({ service, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      const hairTypes = Array.from(
        new Set(sorted.map((booking) => booking.hairType).filter((value) => value && value !== '—')),
      );

      const earliest = sorted.reduce((min, booking) =>
        booking.createdAt.getTime() < min.getTime() ? booking.createdAt : min,
      sorted[0].createdAt);

      const pastBookings: Booking[] = sorted.map((booking) => {
        const appointment = toAppointmentDetail(booking);
        return {
          id: booking.id,
          service: booking.service,
          styleId: booking.styleId || undefined,
          date: appointment.date,
          amount: booking.price,
          hairType: booking.hairType,
          status: mapClientBookingStatus(appointment.status),
        };
      });

      return {
        id: key,
        name: latest.fullName,
        email: latest.email || '—',
        phone: latest.phone || '—',
        location: latest.location,
        memberSince: earliest.toLocaleDateString('default', { month: 'short', year: 'numeric' }),
        totalSpent: completedBookings.reduce((sum, booking) => sum + booking.price, 0),
        totalBookings: sorted.length,
        hairTypes,
        notes: latest.notes || 'No notes yet.',
        favoriteOrders,
        pastBookings,
      };
    })
    .sort((a, b) => b.totalBookings - a.totalBookings);
}

function buildSnapshot(linkedSite: LinkedSite | null, bookings: SiteBookingRecord[]): SiteDataSnapshot {
  const appointments = bookings
    .map(toAppointmentDetail)
    .sort((a, b) => {
      const aBooking = bookings.find((item) => item.id === a.id);
      const bBooking = bookings.find((item) => item.id === b.id);
      const aTime = (aBooking?.startsAt ?? aBooking?.createdAt ?? new Date()).getTime();
      const bTime = (bBooking?.startsAt ?? bBooking?.createdAt ?? new Date()).getTime();
      return bTime - aTime;
    });

  const calendarEvents = bookings
    .map(toCalendarEvent)
    .filter((event): event is CalendarEvent => event !== null)
    .sort((a, b) => {
      const aMinutes = a.startHour * 60 + a.startMinute;
      const bMinutes = b.startHour * 60 + b.startMinute;
      return aMinutes - bMinutes;
    });

  return {
    linkedSite,
    bookings,
    appointments,
    clients: buildClients(bookings),
    calendarEvents,
  };
}

export async function loadSiteData(
  userId: string,
  businessName?: string | null,
): Promise<SiteDataSnapshot> {
  const linkedSite = await fetchLinkedSite(userId, businessName);
  const tableName = getLinkedTableName(linkedSite);

  if (!tableName) {
    return buildSnapshot(linkedSite, []);
  }

  const client = createLinkedSiteClient(linkedSite);
  if (!client) {
    throw new Error('Missing site data Supabase configuration.');
  }

  const { data, error } = await client
    .from(tableName)
    .select('*')
    .eq('user_id', userId)
    .eq('record_type', 'booking');

  if (error) {
    throw new Error(error.message);
  }

  const bookings = normalizeBookingRecords(data ?? []);
  return buildSnapshot(linkedSite, bookings);
}

export function getAppointmentById(
  snapshot: SiteDataSnapshot,
  appointmentId: string,
): AppointmentDetail | undefined {
  return snapshot.appointments.find((appointment) => appointment.id === appointmentId);
}

export function getClientById(snapshot: SiteDataSnapshot, clientId: string): Client | undefined {
  return snapshot.clients.find((client) => client.id === clientId);
}

export function getCalendarEventsForDateKey(
  snapshot: SiteDataSnapshot,
  dateKey: string,
): CalendarEvent[] {
  return snapshot.calendarEvents.filter((event) => event.dateKey === dateKey);
}

function getBookingStartDate(booking: SiteBookingRecord): Date {
  return booking.startsAt ?? booking.createdAt;
}

export function getRevenueForPeriodFromBookings(
  snapshot: SiteDataSnapshot,
  period: Period,
): number {
  const now = new Date();
  let start = startOfDay(now);

  switch (period) {
    case 'day':
      break;
    case 'week': {
      const weekStart = new Date(now);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(now.getDate() - now.getDay());
      start = weekStart;
      break;
    }
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case 'all':
      start = new Date(0);
      break;
  }

  // Count any booking where money was collected: deposit paid, confirmed, or completed.
  // Excludes cancelled bookings and pure in-person (no upfront payment) that are still pending.
  return snapshot.bookings
    .filter((booking) => {
      const status = booking.bookingStatus;
      if (status === 'cancelled' || status === 'canceled') return false;
      if (booking.depositPaid) return true;
      if (status === 'confirmed' || status === 'completed') return true;
      return false;
    })
    .filter((booking) => {
      const date = startOfDay(getBookingStartDate(booking));
      return date >= start && date <= endOfDay(now);
    })
    .reduce((sum, booking) => sum + booking.price, 0);
}

export function getTodayJobStats(snapshot: SiteDataSnapshot) {
  const todayKey = toDateKey(new Date());

  const todayBookings = snapshot.bookings.filter(
    (booking) => booking.startsAt && toDateKey(booking.startsAt) === todayKey,
  );

  const completed = todayBookings.filter(
    (booking) => mapBookingStatus(booking.bookingStatus, booking.startsAt) === 'completed',
  ).length;
  const total = todayBookings.length;

  return {
    completed,
    total,
    progress: total === 0 ? 0 : completed / total,
  };
}

export function getUpcomingAppointments(snapshot: SiteDataSnapshot, limit = 5): AppointmentDetail[] {
  const now = Date.now();

  return snapshot.bookings
    .filter((booking) => mapBookingStatus(booking.bookingStatus, booking.startsAt) === 'upcoming')
    .filter((booking) => {
      const start = booking.startsAt;
      return !start || start.getTime() >= now;
    })
    .sort((a, b) => getBookingStartDate(a).getTime() - getBookingStartDate(b).getTime())
    .slice(0, limit)
    .map(toAppointmentDetail);
}

export function getCompletedAppointments(snapshot: SiteDataSnapshot, limit = 10): AppointmentDetail[] {
  return snapshot.bookings
    .filter((booking) => mapBookingStatus(booking.bookingStatus, booking.startsAt) === 'completed')
    .sort((a, b) => getBookingStartDate(b).getTime() - getBookingStartDate(a).getTime())
    .slice(0, limit)
    .map(toAppointmentDetail);
}

export function getLinkedBusinessLabel(snapshot: SiteDataSnapshot): string {
  return getLinkedSiteLabel(snapshot.linkedSite);
}

export { toDateKey };
