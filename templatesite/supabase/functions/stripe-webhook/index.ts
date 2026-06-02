import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.4.0?target=deno";
import { wrapBrandedEmail } from "../_shared/email-brand.ts";
import { escapeHtml, sendResendEmail } from "../_shared/resend.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeSecret || !webhookSecret || !supabaseUrl || !serviceKey) {
    return new Response("Webhook not configured", { status: 503, headers: cors });
  }

  const stripe = new Stripe(stripeSecret, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400, headers: cors });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    console.error("Webhook signature verification failed:", e);
    return new Response("Invalid signature", { status: 400, headers: cors });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  async function sendDepositEmail(bookingId: string, fallbackEmail: string | null) {
    let customerEmail = fallbackEmail?.trim() || null;
    if (!customerEmail) {
      const { data: row } = await admin
        .from("bookings")
        .select("email")
        .eq("id", bookingId)
        .maybeSingle();
      const e = row && typeof (row as { email?: string }).email === "string"
        ? (row as { email: string }).email.trim()
        : "";
      customerEmail = e || null;
    }

    if (!customerEmail) return;

    const bid = String(bookingId);
    const inner =
      `<p style="margin-top:0;">Hi — we received your deposit for your appointment with Your brand name.</p>` +
      `<p><strong>Booking reference:</strong> <code>${escapeHtml(bid)}</code></p>` +
      `<p style="margin-bottom:0;">Keep this ID for Lookup Booking or any changes. Thank you!</p>`;
    const html = wrapBrandedEmail(inner);
    const salonCopy = Deno.env.get("NOTIFY_TO_EMAIL")?.trim() || "";
    const custNorm = customerEmail.trim().toLowerCase();
    const salonNorm = salonCopy.toLowerCase();
    const bcc = salonCopy && salonNorm !== custNorm ? [salonCopy] : undefined;
    const sent = await sendResendEmail({
      to: [customerEmail],
      bcc,
      subject: `Deposit received — Your brand name (${bid.slice(0, 8)}…)`,
      html,
    });
    if (!sent.ok) {
      console.warn("Resend deposit confirmation skipped:", sent.error);
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.booking_id;
    if (bookingId) {
      const pi =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;

      const { error } = await admin
        .from("bookings")
        .update({
          payment_status: "deposit_paid",
          booking_status: "confirmed",
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: pi,
        })
        .eq("id", bookingId);

      if (error) {
        console.error("Failed to update booking:", error);
        return new Response(JSON.stringify({ error: "DB update failed" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      await sendDepositEmail(String(bookingId), session.customer_email?.trim() || null);
    }
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const bookingId = intent.metadata?.booking_id;
    if (bookingId) {
      const { error } = await admin
        .from("bookings")
        .update({
          payment_status: "deposit_paid",
          booking_status: "confirmed",
          stripe_payment_intent_id: intent.id,
        })
        .eq("id", bookingId)
        .neq("payment_status", "deposit_paid");

      if (error) {
        console.error("Failed to update booking from payment_intent.succeeded:", error);
        return new Response(JSON.stringify({ error: "DB update failed" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const fallbackEmail = typeof intent.receipt_email === "string" ? intent.receipt_email.trim() : null;
      await sendDepositEmail(String(bookingId), fallbackEmail);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
