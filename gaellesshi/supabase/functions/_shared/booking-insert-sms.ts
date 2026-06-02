/**
 * Deduped salon + customer SMS for new bookings (paired with salon_email_* email path).
 */
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isBlooioSmsEnabled } from "./blooio-sms.ts";
import { normalizePhoneToE164 } from "./phone-e164.ts";
import {
  sendCustomerBookingConfirmationSms,
  sendSalonBookingNotificationSms,
} from "./salon-sms.ts";

/** Returns combined row for SMS targeting (prefer post-email claim row). */
function pickRow(
  claimedEmailRow: Record<string, unknown> | null,
  initial: Record<string, unknown>,
): Record<string, unknown> {
  return claimedEmailRow ?? initial;
}

function needsSalonSms(row: Record<string, unknown>): boolean {
  if (!isBlooioSmsEnabled()) return false;
  const notify = Deno.env.get("NOTIFY_TO_PHONE")?.trim();
  if (!notify || !normalizePhoneToE164(notify)) return false;
  return !row["salon_sms_sent_at"];
}

function needsCustomerSms(row: Record<string, unknown>): boolean {
  if (!isBlooioSmsEnabled()) return false;
  const e164 = normalizePhoneToE164(row.phone);
  if (!e164) return false;
  return !row["customer_booking_confirmation_sms_sent_at"];
}

export function shouldSkipBookingNotifyEntirely(
  row: Record<string, unknown>,
): { skip: boolean; reason?: string } {
  const emailDone = Boolean(row["salon_email_sent_at"]);
  const salonSmsDone = !needsSalonSms(row);
  const custSmsDone = !needsCustomerSms(row);
  if (emailDone && salonSmsDone && custSmsDone) {
    return { skip: true, reason: "already_notified" };
  }
  return { skip: false };
}

/** After email succeeds (or skipped as already sent), attach SMS with independent claims. */
export async function dispatchNewBookingSideSmsAfterEmail(
  admin: SupabaseClient,
  bookingId: string,
  claimedEmailRow: Record<string, unknown> | null,
  initialRow: Record<string, unknown>,
): Promise<void> {
  const working = pickRow(claimedEmailRow, initialRow);
  const ts = new Date().toISOString();

  if (needsSalonSms(working)) {
    const { data: claimedSms, error: smsClaimErr } = await admin
      .from("bookings")
      .update({ salon_sms_sent_at: ts })
      .eq("id", bookingId)
      .is("salon_sms_sent_at", null)
      .select("*")
      .maybeSingle();

    if (smsClaimErr) {
      console.warn("salon_sms claim:", smsClaimErr.message);
    } else if (claimedSms) {
      const sent = await sendSalonBookingNotificationSms(claimedSms as Record<string, unknown>);
      if (!sent.ok && !sent.skipped) {
        await admin.from("bookings").update({ salon_sms_sent_at: null }).eq("id", bookingId);
        console.warn("Salon booking SMS failed:", sent.error);
      }
    }
  }

  if (needsCustomerSms(working)) {
    const { data: claimedCust, error: custClaimErr } = await admin
      .from("bookings")
      .update({ customer_booking_confirmation_sms_sent_at: ts })
      .eq("id", bookingId)
      .is("customer_booking_confirmation_sms_sent_at", null)
      .select("*")
      .maybeSingle();

    if (custClaimErr) {
      console.warn("customer sms claim:", custClaimErr.message);
    } else if (claimedCust) {
      const sent = await sendCustomerBookingConfirmationSms(claimedCust as Record<string, unknown>);
      if (!sent.ok && !sent.skipped) {
        await admin.from("bookings").update({ customer_booking_confirmation_sms_sent_at: null }).eq("id", bookingId);
        console.warn("Customer booking SMS failed:", sent.error);
      }
    }
  }
}
