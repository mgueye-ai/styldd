import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  sendCustomerBookingCancelled,
  sendCustomerBookingRescheduled,
  sendSalonBookingCancelled,
  sendSalonBookingRescheduled,
} from "../_shared/salon-emails.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-code",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

type NotifyKind = "cancelled" | "rescheduled";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase not configured" }, 500);

  let body: {
    booking_id?: string;
    kind?: NotifyKind;
    prev_date?: string;
    prev_slot?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const bookingId = String(body.booking_id || "").trim();
  const kind = String(body.kind || "").trim() as NotifyKind;
  if (!bookingId) return json({ error: "booking_id required" }, 400);
  if (kind !== "cancelled" && kind !== "rescheduled") return json({ error: "kind must be cancelled or rescheduled" }, 400);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: row, error: fetchErr } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (fetchErr) return json({ error: fetchErr.message || "Fetch failed" }, 500);
  if (!row) return json({ error: "Booking not found" }, 404);

  const ctx = { prevDate: body.prev_date || "", prevSlot: body.prev_slot || "" };
  let salonSent: { ok: boolean; error?: string };
  let customerSent: { ok: boolean; error?: string };
  if (kind === "cancelled") {
    salonSent = await sendSalonBookingCancelled(row);
    customerSent = await sendCustomerBookingCancelled(row);
  } else {
    salonSent = await sendSalonBookingRescheduled(row, ctx);
    customerSent = await sendCustomerBookingRescheduled(row, ctx);
  }

  if (!salonSent.ok || !customerSent.ok) {
    return json(
      {
        error: "One or more emails failed",
        salon_error: salonSent.error || null,
        customer_error: customerSent.error || null,
      },
      502,
    );
  }

  return json({ ok: true, sent: kind });
});

