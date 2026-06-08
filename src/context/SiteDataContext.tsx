import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
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
import { HOSTED_SITE_TABLE } from '../lib/siteRecords';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const LIVE_POLL_MS = 20_000;

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
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
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
  const silentRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;

    if (!user?.id) {
      setSnapshot(EMPTY_SNAPSHOT);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!silent) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const nextSnapshot = await loadSiteData(
        user.id,
        profile?.business_name ?? profile?.full_name,
      );
      setSnapshot(nextSnapshot);
      if (!silent) setError(null);
    } catch (err) {
      if (!silent) {
        setSnapshot(EMPTY_SNAPSHOT);
        setError(err instanceof Error ? err.message : 'Could not load linked site data.');
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [user?.id, profile?.business_name, profile?.full_name]);

  const scheduleSilentRefresh = useCallback(() => {
    if (silentRefreshTimer.current) clearTimeout(silentRefreshTimer.current);
    silentRefreshTimer.current = setTimeout(() => {
      silentRefreshTimer.current = null;
      void refresh({ silent: true });
    }, 400);
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) return;

    const onRecordChange = (recordType: unknown) => {
      if (recordType === 'booking' || recordType === 'blocked_interval') {
        scheduleSilentRefresh();
      }
    };

    const channel = supabase
      .channel(`site-data-live-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: HOSTED_SITE_TABLE,
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          onRecordChange((payload.new as { record_type?: string })?.record_type);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: HOSTED_SITE_TABLE,
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          onRecordChange((payload.new as { record_type?: string })?.record_type);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: HOSTED_SITE_TABLE,
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          onRecordChange((payload.old as { record_type?: string })?.record_type);
        },
      )
      .subscribe();

    return () => {
      if (silentRefreshTimer.current) clearTimeout(silentRefreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [user?.id, scheduleSilentRefresh]);

  useEffect(() => {
    if (!user?.id) return;

    const poll = setInterval(() => {
      if (appState.current !== 'active') return;
      void refresh({ silent: true });
    }, LIVE_POLL_MS);

    const sub = AppState.addEventListener('change', (nextState) => {
      appState.current = nextState;
      if (nextState === 'active') {
        void refresh({ silent: true });
      }
    });

    return () => {
      clearInterval(poll);
      sub.remove();
    };
  }, [user?.id, refresh]);

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
