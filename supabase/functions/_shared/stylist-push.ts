import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

type SiteRecordRow = {
  id: string;
  user_id: string;
  record_type: string;
  data: Record<string, unknown> | null;
  created_at?: string;
};

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatAppointmentWhen(startsAtRaw: string | null): string {
  if (!startsAtRaw) return 'a time to be scheduled';
  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) return 'a time to be scheduled';

  const time = startsAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(startsAt);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime()) return `today at ${time}`;

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (target.getTime() === tomorrow.getTime()) return `tomorrow at ${time}`;

  const weekday = startsAt.toLocaleDateString('en-US', { weekday: 'long' });
  return `${weekday} at ${time}`;
}

export function buildPushForSiteRecord(record: SiteRecordRow): PushPayload | null {
  const data = record.data ?? {};
  const recordType = record.record_type;

  if (recordType === 'booking') {
    const name = asString(data.full_name, 'A client');
    const service = asString(data.style_name) || asString(data.style_id, 'an appointment');
    const when = formatAppointmentWhen(asString(data.appointment_starts_at) || null);
    const paymentStatus = asString(data.payment_status).toLowerCase();
    const deposit = asNumber(data.deposit_amount);
    const bookingStatus = asString(data.booking_status).toLowerCase();

    if (paymentStatus === 'deposit_paid' || paymentStatus === 'paid') {
      const amount = deposit > 0 ? deposit : asNumber(data.estimated_total);
      return {
        title: 'Payment received',
        body: `You received $${amount.toFixed(2)} from ${name} for ${service}.`,
        data: {
          type: 'payment_received',
          recordId: record.id,
          screen: 'AppointmentDetail',
        },
      };
    }

    if (bookingStatus === 'cancelled' || bookingStatus === 'canceled') {
      return {
        title: 'Booking cancelled',
        body: `${name} cancelled ${service}.`,
        data: { type: 'booking_cancelled', recordId: record.id, screen: 'Dashboard' },
      };
    }

    return {
      title: 'New booking',
      body: `${name} booked ${service} for ${when}.`,
      data: { type: 'new_booking', recordId: record.id, screen: 'AppointmentDetail' },
    };
  }

  if (recordType === 'review') {
    const name = asString(data.client_name, 'A client');
    const rating = Math.min(5, Math.max(1, Math.round(asNumber(data.rating, 5))));
    return {
      title: 'New client review',
      body: `${name} left a ${rating}-star review on your site.`,
      data: { type: 'new_review', recordId: record.id, screen: 'ReviewsSettings' },
    };
  }

  if (recordType === 'inquiry') {
    const name =
      asString(data.full_name) ||
      asString(data.name) ||
      asString(data.email, 'Someone');
    return {
      title: 'New site inquiry',
      body: `${name} sent a message from your website.`,
      data: { type: 'new_inquiry', recordId: record.id, screen: 'Dashboard' },
    };
  }

  return null;
}

export async function sendExpoPush(
  tokens: string[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!tokens.length) return { sent: 0, failed: 0 };

  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (expoAccessToken) {
    headers.Authorization = `Bearer ${expoAccessToken}`;
  }

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Expo push send failed');
  }

  const result = await res.json();
  const rows = Array.isArray(result?.data) ? result.data : [];
  const failed = rows.filter((row: { status?: string }) => row.status === 'error').length;
  return { sent: rows.length - failed, failed };
}

export async function sendPushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; skipped?: string }> {
  const { data: tokenRows, error } = await admin
    .from('styld_push_tokens')
    .select('expo_push_token')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  const tokens = (tokenRows ?? [])
    .map((row) => asString((row as { expo_push_token?: string }).expo_push_token))
    .filter(Boolean);

  if (!tokens.length) return { sent: 0, failed: 0, skipped: 'no_tokens' };

  return sendExpoPush(tokens, payload);
}

export async function notifyStylistForSiteRecord(
  admin: SupabaseClient,
  record: SiteRecordRow,
): Promise<{ sent: number; failed: number; skipped?: string }> {
  const payload = buildPushForSiteRecord(record);
  if (!payload) return { sent: 0, failed: 0, skipped: 'unsupported_record' };

  const { data: tokenRows, error } = await admin
    .from('styld_push_tokens')
    .select('expo_push_token')
    .eq('user_id', record.user_id);

  if (error) throw new Error(error.message);

  const tokens = (tokenRows ?? [])
    .map((row) => asString((row as { expo_push_token?: string }).expo_push_token))
    .filter(Boolean);

  if (!tokens.length) return { sent: 0, failed: 0, skipped: 'no_tokens' };

  return sendExpoPush(tokens, payload);
}
