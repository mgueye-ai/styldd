/**
 * Called from the website after a successful `bookings` or `inquiries` insert.
 * verify_jwt: false — public forms are anonymous (see create-checkout-session). Validates row age + claim dedupe.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  dispatchNewBookingSideSmsAfterEmail,
  shouldSkipBookingNotifyEntirely,
} from "../_shared/booking-insert-sms.ts";
import {
  sendCustomerBookingConfirmation,
  sendSalonBookingNotification,
} from "../_shared/salon-emails.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const MAX_AGE_MS = 25 * 60 * 1000;

function asRow(r: Record<string, unknown>): Record<string, unknown> {
  return r;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const notifyTo = Deno.env.get("NOTIFY_TO_EMAIL")?.trim();
  if (!notifyTo) {
    return json({ error: "NOTIFY_TO_EMAIL is not configured" }, 503);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  let body: { booking_id?: string; inquiry_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const bid = body.booking_id?.trim();
  const iid = body.inquiry_id?.trim();
  if (!bid) {
    if (iid) return json({ ok: true, skipped: true, reason: "inquiry emails disabled" });
    return json({ error: "booking_id is required" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ts = new Date().toISOString();

  const { data: row, error: fetchErr } = await admin.from("bookings").select("*").eq("id", bid).maybeSingle();
  if (fetchErr) return json({ error: fetchErr.message }, 500);
  if (!row) return json({ error: "Not found" }, 404);

  const rowRecord = asRow(row as Record<string, unknown>);
  const { skip, reason } = shouldSkipBookingNotifyEntirely(rowRecord);
  if (skip) {
    return json({ ok: true, skipped: true, reason });
  }

  let claimedEmailRow: Record<string, unknown> | null = null;

  if (!rowRecord["salon_email_sent_at"]) {
    const created = new Date(String(rowRecord["created_at"]));
    if (Number.isNaN(created.getTime()) || Date.now() - created.getTime() > MAX_AGE_MS) {
      return json({ error: "Booking is too old for this notification path" }, 400);
    }

    const { data: claimed, error: claimErr } = await admin
      .from("bookings")
      .update({ salon_email_sent_at: ts })
      .eq("id", bid)
      .is("salon_email_sent_at", null)
      .select("*")
      .maybeSingle();

    if (claimErr) {
      console.error(claimErr);
      return json({ error: claimErr.message }, 500);
    }

    if (!claimed) {
      const { data: refreshed } = await admin.from("bookings").select("*").eq("id", bid).maybeSingle();
      const r2 = refreshed ? asRow(refreshed as Record<string, unknown>) : rowRecord;
      await dispatchNewBookingSideSmsAfterEmail(admin, bid, null, r2);
      const again = shouldSkipBookingNotifyEntirely(r2);
      if (again.skip) {
        return json({ ok: true, skipped: true, reason: again.reason });
      }
      return json({ ok: true, sent: "booking" });
    }

    const claimedRec = asRow(claimed as Record<string, unknown>);
    const sent = await sendSalonBookingNotification(claimedRec);
    if (!sent.ok) {
      await admin.from("bookings").update({ salon_email_sent_at: null }).eq("id", bid);
      return json({ error: sent.error || "Resend failed" }, 502);
    }
    const customerSent = await sendCustomerBookingConfirmation(claimedRec);
    if (!customerSent.ok) {
      console.warn("Customer booking confirmation failed:", customerSent.error);
    }
    claimedEmailRow = claimedRec;
  }

  await dispatchNewBookingSideSmsAfterEmail(admin, bid, claimedEmailRow, rowRecord);
  return json({ ok: true, sent: "booking" });
});
