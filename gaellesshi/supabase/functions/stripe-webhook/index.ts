import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.4.0?target=deno";
import {
  emailButton,
  emailCallout,
  emailDetailRows,
  emailEyebrow,
  emailP,
  emailSectionTitle,
  emailSignoff,
  wrapBrandedEmail,
} from "../_shared/email-brand.ts";
import { escapeHtml, sendResendEmail } from "../_shared/resend.ts";
import { sendDepositReceivedSms } from "../_shared/salon-sms.ts";

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

  async function sendDepositEmailAndSms(bookingId: string, fallbackEmail: string | null) {
    const bid = String(bookingId);
    const { data: row } = await admin
      .from("bookings")
      .select("email,phone")
      .eq("id", bid)
      .maybeSingle();

    let customerEmail = fallbackEmail?.trim() || null;
    if (!customerEmail) {
      const e = row && typeof (row as { email?: string }).email === "string"
        ? (row as { email: string }).email.trim()
        : "";
      customerEmail = e || null;
    }

    if (customerEmail) {
      const baseUrl = (Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL") || "").trim().replace(/\/$/, "");
      const detailsLink = baseUrl ? `${baseUrl}/booking-details.html?booking_id=${encodeURIComponent(bid)}` : "";
      const inner =
        emailEyebrow("Payment received") +
        emailSectionTitle("Your deposit is in") +
        emailP(`Hi there — thank you! We have received your deposit for your <strong>Hair by Nadjae</strong> appointment.`) +
        emailDetailRows([{ label: "Booking reference", valueHtml: `<code>${escapeHtml(bid)}</code>` }]) +
        emailCallout(
          `<p style="margin:0;">Keep this ID handy for <strong>Lookup Booking</strong> or if you need to make a change.</p>`,
          "rose",
        ) +
        (detailsLink ? emailButton(detailsLink, "Open your booking") : emailP(`Thank you — we will see you soon!`, { marginBottom: 0 })) +
        emailSignoff();
      const html = wrapBrandedEmail(inner);
      const salonCopy = Deno.env.get("NOTIFY_TO_EMAIL")?.trim() || "";
      const custNorm = customerEmail.trim().toLowerCase();
      const salonNorm = salonCopy.toLowerCase();
      const bcc = salonCopy && salonNorm !== custNorm ? [salonCopy] : undefined;
      const sent = await sendResendEmail({
        to: [customerEmail],
        bcc,
        subject: `Deposit received — Hair by Nadjae (${bid.slice(0, 8)}…)`,
        html,
      });
      if (!sent.ok) {
        console.warn("Resend deposit confirmation skipped:", sent.error);
      }
    }

    const rowRec = row ? (row as Record<string, unknown>) : null;
    const smsSent = await sendDepositReceivedSms(bid, rowRec);
    if (!smsSent.ok) {
      console.warn("Deposit SMS failed:", smsSent.error);
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

      await sendDepositEmailAndSms(String(bookingId), session.customer_email?.trim() || null);
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
      await sendDepositEmailAndSms(String(bookingId), fallbackEmail);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
