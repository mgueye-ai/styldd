/**
 * Salon email notifications — triggered by Supabase Database Webhooks on INSERT.
 * Uses claim-first dedupe with `salon_email_sent_at` (same as `notify-salon`).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  sendCustomerBookingConfirmation,
  sendSalonBookingNotification,
} from "../_shared/salon-emails.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-salon-site-notify-secret",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function verifyNotifySecret(req: Request): boolean {
  const secret = Deno.env.get("SALON_SITE_NOTIFY_SECRET");
  if (!secret || !secret.length) return false;
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const header = req.headers.get("x-salon-site-notify-secret")?.trim() ?? "";
  return bearer === secret || header === secret;
}

function isDbWebhookPayload(
  p: unknown,
): p is {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown>;
} {
  return typeof p === "object" && p !== null && "record" in p && "table" in p;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!verifyNotifySecret(req)) {
    return json(
      { error: "Unauthorized — set SALON_SITE_NOTIFY_SECRET and send it as Bearer or x-salon-site-notify-secret" },
      401,
    );
  }

  const notifyTo = Deno.env.get("NOTIFY_TO_EMAIL")?.trim();
  if (!notifyTo) {
    return json({ error: "NOTIFY_TO_EMAIL is not configured" }, 503);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required for dedupe" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!isDbWebhookPayload(payload) || !payload.record || !payload.table) {
    return json({ error: "Expected Database Webhook body with table and record" }, 400);
  }

  if (payload.type && payload.type !== "INSERT") {
    return json({ ok: true, skipped: true, reason: "not an INSERT" });
  }

  const table = payload.table;
  const record = payload.record;
  const ts = new Date().toISOString();

  if (table === "bookings") {
    const id = String(record.id ?? "");
    if (!id) return json({ error: "Missing booking id" }, 400);

    const { data: claimed, error: claimErr } = await admin
      .from("bookings")
      .update({ salon_email_sent_at: ts })
      .eq("id", id)
      .is("salon_email_sent_at", null)
      .select("*")
      .maybeSingle();

    if (claimErr) {
      console.error("bookings claim:", claimErr);
      return json(
        { error: claimErr.message, hint: "Run migration 20260505120000_salon_email_sent.sql if column missing" },
        500,
      );
    }
    if (!claimed) {
      return json({ ok: true, skipped: true, reason: "already_notified" });
    }

    const sent = await sendSalonBookingNotification(claimed);
    if (!sent.ok) {
      await admin.from("bookings").update({ salon_email_sent_at: null }).eq("id", id);
      return json({ error: sent.error || "Resend failed" }, 502);
    }
    const customerSent = await sendCustomerBookingConfirmation(claimed);
    if (!customerSent.ok) {
      console.warn("Customer booking confirmation failed:", customerSent.error);
    }
    return json({ ok: true, sent: "booking" });
  }

  if (table === "inquiries") {
    return json({ ok: true, skipped: true, reason: "inquiry emails disabled" });
  }

  return json({ ok: true, skipped: true, reason: `table ${table} not handled` });
});
