import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
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
import { AppNotification } from '../components/NotificationsPanel';
import { SiteReview } from '../data/reviewsSettings';
import { HOSTED_SITE_TABLE } from '../lib/siteRecords';
import { buildAllNotifications } from '../lib/notifications';
import { navigateFromPushData } from '../lib/navigationRef';
import { syncAppointmentReminders } from '../lib/appointmentReminders';
import { registerForPushNotificationsAsync } from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useSiteData } from './SiteDataContext';

const READ_IDS_KEY = 'styld_notification_read_ids';

type PushNotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  panelVisible: boolean;
  openPanel: () => void;
  closePanel: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

const PushNotificationsContext = createContext<PushNotificationsContextValue | undefined>(
  undefined,
);

export function PushNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { bookings } = useSiteData();
  const [reviews, setReviews] = useState<SiteReview[]>([]);
  const [inquiries, setInquiries] = useState<{ id: string; name: string; createdAt: Date }[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [panelVisible, setPanelVisible] = useState(false);
  const seenRecordIds = useRef<Set<string>>(new Set());

  const loadReadIds = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(READ_IDS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setReadIds(new Set(parsed.filter((id) => typeof id === 'string')));
      }
    } catch {
      // ignore corrupt cache
    }
  }, []);

  const persistReadIds = useCallback(async (next: Set<string>) => {
    setReadIds(next);
    await AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify([...next]));
  }, []);

  const loadSupplementalNotifications = useCallback(async (userId: string) => {
    const [reviewResult, inquiryResult] = await Promise.all([
      supabase
        .from(HOSTED_SITE_TABLE)
        .select('id, data, created_at')
        .eq('user_id', userId)
        .eq('record_type', 'review')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from(HOSTED_SITE_TABLE)
        .select('id, data, created_at')
        .eq('user_id', userId)
        .eq('record_type', 'inquiry')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (!reviewResult.error) {
      setReviews(
        (reviewResult.data ?? []).map((row) => {
          const data =
            row.data && typeof row.data === 'object'
              ? (row.data as Record<string, unknown>)
              : {};
          const name =
            typeof data.client_name === 'string' && data.client_name.trim()
              ? data.client_name.trim()
              : 'A client';
          const ratingRaw =
            typeof data.rating === 'number' ? data.rating : Number(data.rating);
          const rating = Number.isFinite(ratingRaw)
            ? Math.min(5, Math.max(1, Math.round(ratingRaw)))
            : 5;
          return {
            id: row.id,
            bookingId: typeof data.booking_id === 'string' ? data.booking_id : '',
            clientName: name,
            rating,
            message: typeof data.message === 'string' ? data.message : '',
            published: data.published !== false,
            source: typeof data.source === 'string' ? data.source : '',
            createdAt: row.created_at ? new Date(row.created_at) : new Date(),
          };
        }),
      );
    }

    if (!inquiryResult.error) {
      setInquiries(
        (inquiryResult.data ?? []).map((row) => {
          const data =
            row.data && typeof row.data === 'object'
              ? (row.data as Record<string, unknown>)
              : {};
          const name =
            (typeof data.full_name === 'string' && data.full_name.trim()) ||
            (typeof data.name === 'string' && data.name.trim()) ||
            (typeof data.email === 'string' && data.email.trim()) ||
            'Someone';
          return {
            id: row.id,
            name,
            createdAt: row.created_at ? new Date(row.created_at) : new Date(),
          };
        }),
      );
    }
  }, []);

  useEffect(() => {
    loadReadIds();
  }, [loadReadIds]);

  useEffect(() => {
    if (!user?.id) return;

    registerForPushNotificationsAsync(user.id).catch((err) => {
      console.warn('Push registration failed:', err);
    });
    loadSupplementalNotifications(user.id);
  }, [user?.id, loadSupplementalNotifications]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      navigateFromPushData(data);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`styld-push-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: HOSTED_SITE_TABLE,
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const record = payload.new as { id?: string; record_type?: string };
          if (!record.id || seenRecordIds.current.has(record.id)) return;
          seenRecordIds.current.add(record.id);

          if (['review', 'inquiry'].includes(String(record.record_type))) {
            loadSupplementalNotifications(user.id);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadSupplementalNotifications]);

  useEffect(() => {
    if (!user?.id) return;
    syncAppointmentReminders(bookings).catch((err) => {
      console.warn('Appointment reminder sync failed:', err);
    });
  }, [bookings, user?.id]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state !== 'active' || !user?.id) return;
      Notifications.setBadgeCountAsync(0).catch(() => {});
      syncAppointmentReminders(bookings).catch(() => {});
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [user?.id, bookings]);

  const notifications = useMemo(() => {
    const items = buildAllNotifications(bookings, reviews, inquiries);
    return items.map((item) => ({
      ...item,
      unread: !readIds.has(item.id),
    }));
  }, [bookings, reviews, inquiries, readIds]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.unread).length,
    [notifications],
  );

  const markRead = useCallback(
    (id: string) => {
      if (readIds.has(id)) return;
      const next = new Set(readIds);
      next.add(id);
      persistReadIds(next);
    },
    [readIds, persistReadIds],
  );

  const markAllRead = useCallback(() => {
    const next = new Set(readIds);
    for (const item of notifications) next.add(item.id);
    persistReadIds(next);
  }, [notifications, readIds, persistReadIds]);

  const value = useMemo<PushNotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      panelVisible,
      openPanel: () => setPanelVisible(true),
      closePanel: () => setPanelVisible(false),
      markRead,
      markAllRead,
    }),
    [notifications, unreadCount, panelVisible, markRead, markAllRead],
  );

  return (
    <PushNotificationsContext.Provider value={value}>{children}</PushNotificationsContext.Provider>
  );
}

export function usePushNotifications() {
  const ctx = useContext(PushNotificationsContext);
  if (!ctx) {
    throw new Error('usePushNotifications must be used within PushNotificationsProvider');
  }
  return ctx;
}
