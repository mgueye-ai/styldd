import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  sendCustomerBookingCancelled,
  sendSalonBookingCancelled,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const adminCode = Deno.env.get("ADMIN_ACCESS_CODE")?.trim() || "0000";
  const headerCode = req.headers.get("x-admin-code")?.trim();
  let body: { booking_id?: string; admin_code?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const bookingId = body.booking_id?.trim();
  const code = (body.admin_code || headerCode || "").trim();
  if (!bookingId) return json({ error: "booking_id required" }, 400);
  if (code !== adminCode) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase not configured" }, 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing, error: getErr } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (getErr) return json({ error: getErr.message || "Lookup failed" }, 500);
  if (!existing) return json({ error: "Booking not found" }, 404);

  const { data: updated, error } = await admin
    .from("bookings")
    .update({ booking_status: "cancelled" })
    .eq("id", bookingId)
    .select("*")
    .maybeSingle();

  if (error) return json({ error: error.message || "Update failed" }, 500);
  const row = updated || existing;
  const salonSent = await sendSalonBookingCancelled(row);
  const customerSent = await sendCustomerBookingCancelled(row);
  if (!salonSent.ok || !customerSent.ok) {
    return json(
      {
        ok: true,
        warning: "Booking cancelled, but one or more emails failed",
        salon_error: salonSent.error || null,
        customer_error: customerSent.error || null,
      },
      200,
    );
  }
  return json({ ok: true });
});
