import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

type StripeSession = {
  id?: string;
  url?: string;
  error?: { message?: string };
};

type StripePaymentIntent = {
  id?: string;
  client_secret?: string;
  error?: { message?: string };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecret) {
    return json({ error: "Stripe is not configured (missing STRIPE_SECRET_KEY)." }, 503);
  }

  let body: {
    mode?: string;
    booking_id?: string;
    success_url?: string;
    cancel_url?: string;
    email?: string;
    style_id?: string;
    style_name?: string;
    deposit_amount?: number;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const mode = (body.mode || "redirect").trim().toLowerCase();
  const bookingId = body.booking_id?.trim();
  const successUrl = body.success_url?.trim();
  const cancelUrl = body.cancel_url?.trim();
  if (!bookingId) {
    return json({ error: "booking_id is required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Supabase environment not configured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (mode === "embedded") {
    const deposit = Number(body.deposit_amount);
    const cents = Math.round(deposit * 100);
    if (!Number.isFinite(cents) || cents < 50) {
      return json({ error: "Deposit must be at least $0.50 USD for card processing" }, 400);
    }

    const styleId = String(body.style_id ?? "");
    const isHouse = styleId.startsWith("house-");
    const styleLabel = String(body.style_name || "Appointment");
    const customerEmail = String(body.email || "").trim();

    const form = new URLSearchParams();
    form.set("amount", String(cents));
    form.set("currency", "usd");
    form.set("automatic_payment_methods[enabled]", "true");
    form.set("metadata[booking_id]", bookingId);
    form.set("metadata[style_id]", styleId);
    if (customerEmail) form.set("receipt_email", customerEmail);
    form.set(
      "description",
      `Hair by Nadjae deposit (${styleLabel})${isHouse ? " + house-call deposit" : ""} · ${bookingId.slice(0, 8)}…`,
    );

    const stripeRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const intent = (await stripeRes.json()) as StripePaymentIntent;
    if (!stripeRes.ok) {
      const detail = intent?.error?.message || `Stripe returned HTTP ${stripeRes.status}`;
      return json({ error: detail }, 502);
    }
    if (!intent.client_secret || !intent.id) {
      return json({ error: "Stripe did not return payment intent credentials" }, 500);
    }
    return json({ client_secret: intent.client_secret, payment_intent_id: intent.id });
  }

  if (!successUrl || !cancelUrl) {
    return json({ error: "success_url and cancel_url are required for redirect mode" }, 400);
  }

  const { data: booking, error: fetchErr } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle();

  if (fetchErr) {
    console.error("create-checkout-session fetch error:", fetchErr, "booking_id:", bookingId);
    return json(
      {
        error: fetchErr.message || "Could not load booking",
        hint:
          "Confirm this project matches your site (same Supabase URL), run supabase/schema.sql (payment columns), and redeploy this function.",
      },
      500,
    );
  }

  if (!booking) {
    console.error("create-checkout-session: no row for booking_id:", bookingId);
    return json(
      {
        error: "Booking not found",
        hint:
          "The booking was saved in the browser project, but this Edge Function cannot see that row. Usually the deployed project ref does not match js/supabase-config.local.js.",
      },
      404,
    );
  }

  const b = booking as Record<string, unknown>;
  const payStatus = b.payment_status as string | undefined;
  if (payStatus && payStatus !== "pending") {
    return json({ error: "This booking is not awaiting deposit payment" }, 400);
  }

  const deposit = Number(b.deposit_amount);
  const cents = Math.round(deposit * 100);
  if (!Number.isFinite(cents) || cents < 50) {
    return json({ error: "Deposit must be at least $0.50 USD for card processing" }, 400);
  }

  const styleId = String(b.style_id ?? "");
  const isHouse = styleId.startsWith("house-");
  const styleLabel = (b.style_name as string) || "Appointment";
  const sessionSuccessUrl = successUrl.includes("{CHECKOUT_SESSION_ID}")
    ? successUrl
    : `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", sessionSuccessUrl);
  form.set("cancel_url", cancelUrl);
  const customerEmail = (b.email as string) || "";
  if (customerEmail) form.set("customer_email", customerEmail);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][unit_amount]", String(cents));
  form.set("line_items[0][price_data][product_data][name]", `Hair by Nadjae - deposit (${styleLabel})`);
  const depDesc =
    `Non-refundable deposit. Includes 10% of your service estimate${
      isHouse ? " plus a $15 house-call deposit" : ""
    }. Booking ref ${String(b.id).slice(0, 8)}…`;
  form.set("line_items[0][price_data][product_data][description]", depDesc);
  form.set("metadata[booking_id]", String(b.id));
  form.set("payment_intent_data[metadata][booking_id]", String(b.id));

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const session = (await stripeRes.json()) as StripeSession;
  if (!stripeRes.ok) {
    const detail = session?.error?.message || `Stripe returned HTTP ${stripeRes.status}`;
    return json({ error: detail }, 502);
  }

  const { error: updateErr } = await admin
    .from("bookings")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", bookingId);

  if (updateErr) {
    console.error("checkout session created but DB update failed:", updateErr);
  }

  if (!session.url) {
    return json({ error: "Stripe did not return a checkout URL" }, 500);
  }

  return json({ url: session.url });
});
