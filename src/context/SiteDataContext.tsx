import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppointmentDetail } from '../data/appointments';
import { Client } from '../data/clients';
import { CalendarEvent } from '../data/calendarEvents';
import { Period } from '../data/periods';
import { SiteBookingRecord } from '../lib/siteData';
import {
  getAppointmentById as findAppointmentById,
  getCalendarEventsForDateKey as findCalendarEventsForDateKey,
  getClientById as findClientById,
  getCompletedAppointments,
  getLinkedBusinessLabel,
  getMoneyStatsForLastDaysFromBookings,
  getRevenueForPeriodFromBookings,
  getTodayJobStats,
  getUpcomingAppointments,
  loadSiteData,
  MoneyStats,
  SiteDataSnapshot,
} from '../lib/siteData';
import { useAuth } from './AuthContext';

const EMPTY_SNAPSHOT: SiteDataSnapshot = {
  linkedSite: null,
  bookings: [],
  appointments: [],
  clients: [],
  calendarEvents: [],
};

type SiteDataContextValue = {
  linkedSite: LinkedSite | null;
  isLoading: boolean;
  error: string | null;
  hasLinkedSite: boolean;
  businessLabel: string;
  appointments: AppointmentDetail[];
  bookings: SiteBookingRecord[];
  clients: Client[];
  refresh: () => Promise<void>;
  getAppointmentById: (id: string) => AppointmentDetail | undefined;
  getClientById: (id: string) => Client | undefined;
  getCalendarEventsForDateKey: (dateKey: string) => CalendarEvent[];
  getRevenueForPeriod: (period: Period) => number;
  getMoneyStatsForLastDays: (days: number) => MoneyStats;
  getTodayJobStats: () => { completed: number; total: number; progress: number };
  getUpcomingAppointments: (limit?: number) => AppointmentDetail[];
  getCompletedAppointments: () => AppointmentDetail[];
};

const SiteDataContext = createContext<SiteDataContextValue | undefined>(undefined);

export function SiteDataProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [snapshot, setSnapshot] = useState<SiteDataSnapshot>(EMPTY_SNAPSHOT);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setSnapshot(EMPTY_SNAPSHOT);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextSnapshot = await loadSiteData(
        user.id,
        profile?.business_name ?? profile?.full_name,
      );
      setSnapshot(nextSnapshot);
    } catch (err) {
      setSnapshot(EMPTY_SNAPSHOT);
      setError(err instanceof Error ? err.message : 'Could not load linked site data.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, profile?.business_name, profile?.full_name]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<SiteDataContextValue>(
    () => ({
      linkedSite: snapshot.linkedSite,
      isLoading,
      error,
      hasLinkedSite: Boolean(snapshot.linkedSite?.table_name && user?.id),
      businessLabel: getLinkedBusinessLabel(snapshot),
      appointments: snapshot.appointments,
      bookings: snapshot.bookings,
      clients: snapshot.clients,
      refresh,
      getAppointmentById: (id: string) => findAppointmentById(snapshot, id),
      getClientById: (id: string) => findClientById(snapshot, id),
      getCalendarEventsForDateKey: (dateKey: string) =>
        findCalendarEventsForDateKey(snapshot, dateKey),
      getRevenueForPeriod: (period: Period) => getRevenueForPeriodFromBookings(snapshot, period),
      getMoneyStatsForLastDays: (days: number) => getMoneyStatsForLastDaysFromBookings(snapshot, days),
      getTodayJobStats: () => getTodayJobStats(snapshot),
      getUpcomingAppointments: (limit?: number) => getUpcomingAppointments(snapshot, limit ?? 5),
      getCompletedAppointments: () => getCompletedAppointments(snapshot),
    }),
    [snapshot, isLoading, error, refresh],
  );

  return <SiteDataContext.Provider value={value}>{children}</SiteDataContext.Provider>;
}

export function useSiteData() {
  const context = useContext(SiteDataContext);

  if (!context) {
    throw new Error('useSiteData must be used within SiteDataProvider');
  }

  return context;
}
