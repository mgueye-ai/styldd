import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { SiteBookingRecord } from './siteData';

const REMINDER_PREFIX = 'styld-reminder-';
const MAX_SCHEDULED = 50;

/** Minutes before appointment to fire each reminder. */
const REMINDER_OFFSETS = [
  { key: '1h', minutes: 60, title: 'Appointment in 1 hour' },
  { key: 'morning', minutes: null, title: 'Appointment today' },
] as const;

function formatTime(startsAt: Date): string {
  return startsAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function morningReminderAt(startsAt: Date): Date | null {
  const reminder = new Date(startsAt);
  reminder.setHours(8, 0, 0, 0);
  if (reminder.getTime() >= startsAt.getTime()) return null;
  if (reminder.getTime() <= Date.now()) return null;
  return reminder;
}

function isEligible(booking: SiteBookingRecord): boolean {
  if (!booking.startsAt) return false;
  const status = booking.bookingStatus.toLowerCase();
  if (status === 'cancelled' || status === 'canceled' || status === 'completed') return false;
  return booking.startsAt.getTime() > Date.now();
}

function reminderBody(booking: SiteBookingRecord, startsAt: Date, offsetKey: string): string {
  const time = formatTime(startsAt);
  if (offsetKey === 'morning') {
    return `${booking.fullName} — ${booking.service} at ${time}.`;
  }
  return `${booking.fullName} — ${booking.service} at ${time}.`;
}

async function ensureReminderChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Appointment reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

async function cancelExistingReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.identifier.startsWith(REMINDER_PREFIX))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

export async function syncAppointmentReminders(bookings: SiteBookingRecord[]): Promise<void> {
  if (!Device.isDevice) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await ensureReminderChannel();

  const upcoming = bookings
    .filter(isEligible)
    .sort((a, b) => (a.startsAt!.getTime() - b.startsAt!.getTime()))
    .slice(0, MAX_SCHEDULED);

  await cancelExistingReminders();

  const now = Date.now();

  for (const booking of upcoming) {
    const startsAt = booking.startsAt!;

    for (const offset of REMINDER_OFFSETS) {
      let fireAt: Date | null = null;

      if (offset.key === 'morning') {
        fireAt = morningReminderAt(startsAt);
      } else if (offset.minutes !== null) {
        fireAt = new Date(startsAt.getTime() - offset.minutes * 60_000);
        if (fireAt.getTime() <= now) fireAt = null;
      }

      if (!fireAt) continue;

      const identifier = `${REMINDER_PREFIX}${offset.key}-${booking.id}`;

      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: offset.title,
          body: reminderBody(booking, startsAt, offset.key),
          sound: true,
          data: {
            type: 'appointment_reminder',
            recordId: booking.id,
            screen: 'AppointmentDetail',
          },
          ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
        },
      });
    }
  }
}
