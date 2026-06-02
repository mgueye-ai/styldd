/**
 * Scheduled (cron): owner digest for today (ET) + client reminders ~24h before appointment start.
 * Protect with Authorization: Bearer ${CRON_SECRET}.
 *
 * Run at least hourly so the "24 hours before start" reminder fires soon after the window opens.
 *
 *   curl -X POST "$SUPABASE_URL/functions/v1/daily-booking-emails" \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { isBlooioSmsEnabled } from "../_shared/blooio-sms.ts";
import { normalizePhoneToE164 } from "../_shared/phone-e164.ts";
import {
  sendCustomerAppointmentReminder,
  sendOwnerDailyAppointmentDigest,
} from "../_shared/salon-emails.ts";
import {
  sendCustomerAppointmentReminderSms,
  sendOwnerDailyAppointmentDigestSms,
} from "../_shared/salon-sms.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MS_24H = 24 * 60 * 60 * 1000;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function todayEtYyyyMmDd(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const y = map.year;
  const m = map.month;
  const d = map.day;
  return `${y}-${m}-${d}`;
}

function isCancelledRow(row: Record<string, unknown>): boolean {
  const slot = String(row.appointment_slot ?? "").toLowerCase();
  const notes = String(row.notes ?? "").toLowerCase();
  const st = String(row.booking_status ?? "").toLowerCase();
  return slot.includes("cancelled") || notes.includes("[cancelled]") || st === "cancelled";
}

/** First eligible moment to send 24h-before reminder: now >= startsAt - 24h, appointment still in the future. */
function isReminderDueNow(row: Record<string, unknown>, nowMs: number): boolean {
  const raw = row["appointment_starts_at"];
  if (raw == null || raw === "") return false;
  const starts = new Date(String(raw)).getTime();
  if (!Number.isFinite(starts)) return false;
  if (starts <= nowMs) return false;
  return nowMs >= starts - MS_24H;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("CRON_SECRET")?.trim();
  const auth = req.headers.get("Authorization")?.trim();
  if (!secret || auth !== `Bearer ${secret}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const isoToday = todayEtYyyyMmDd();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const { data: todayRows, error: fetchErr } = await admin
    .from("bookings")
    .select("*")
    .eq("appointment_date", isoToday)
    .order("appointment_starts_at", { ascending: true });

  if (fetchErr) {
    console.error(fetchErr);
    return json({ error: fetchErr.message }, 500);
  }

  const digestRows = Array.isArray(todayRows) ? todayRows : [];
  const digest = await sendOwnerDailyAppointmentDigest(digestRows, isoToday);
  if (!digest.ok) {
    console.warn("Owner digest failed:", digest.error);
  }

  const digestSms = await sendOwnerDailyAppointmentDigestSms(digestRows, isoToday);
  if (!digestSms.ok && !digestSms.skipped) {
    console.warn("Owner digest SMS failed:", digestSms.error);
  }

  const { data: reminderPool, error: remFetchErr } = await admin
    .from("bookings")
    .select("*")
    .or("day_reminder_sent_at.is.null,day_reminder_sms_sent_at.is.null")
    .not("appointment_starts_at", "is", null)
    .gt("appointment_starts_at", nowIso);

  if (remFetchErr) {
    console.error(remFetchErr);
    return json({ error: remFetchErr.message }, 500);
  }

  const pool = Array.isArray(reminderPool) ? reminderPool : [];
  let remindersSent = 0;
  let remindersSmsSent = 0;
  let remindersSkipped = 0;

  for (const row of pool) {
    if (isCancelledRow(row)) {
      remindersSkipped++;
      continue;
    }
    if (!isReminderDueNow(row, nowMs)) {
      remindersSkipped++;
      continue;
    }

    const ts = new Date().toISOString();
    const rid = String(row["id"] ?? "");

    const wantsEmail = !row["day_reminder_sent_at"] &&
      String(row["email"] ?? "").trim().includes("@");
    const wantsSms =
      isBlooioSmsEnabled() && !row["day_reminder_sms_sent_at"] && normalizePhoneToE164(row["phone"]);

    if (!wantsEmail && !wantsSms) {
      remindersSkipped++;
      continue;
    }

    if (wantsEmail) {
      const sent = await sendCustomerAppointmentReminder(row);
      if (!sent.ok) {
        console.warn("Reminder email failed for", rid, sent.error);
      } else {
        const { error: upErr } = await admin
          .from("bookings")
          .update({ day_reminder_sent_at: ts })
          .eq("id", rid);
        if (upErr) console.warn("Could not mark reminder email sent:", rid, upErr);
        else remindersSent++;
      }
    }

    if (wantsSms) {
      const sentSms = await sendCustomerAppointmentReminderSms(row);
      if (!sentSms.ok) {
        console.warn("Reminder SMS failed for", rid, sentSms.error);
      } else if (!sentSms.skipped) {
        const { error: smsUp } = await admin
          .from("bookings")
          .update({ day_reminder_sms_sent_at: ts })
          .eq("id", rid);
        if (smsUp) console.warn("Could not mark reminder SMS sent:", rid, smsUp);
        else remindersSmsSent++;
      }
    }
  }

  return json({
    ok: true,
    date: isoToday,
    digest_ok: digest.ok,
    digest_error: digest.error ?? null,
    digest_sms_ok: digestSms.ok,
    digest_sms_error: digestSms.ok ? null : (digestSms.error ?? null),
    reminder_pool_size: pool.length,
    reminders_sent: remindersSent,
    reminders_sms_sent: remindersSmsSent,
    reminders_skipped: remindersSkipped,
  });
});
