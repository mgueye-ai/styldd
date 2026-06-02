/**
 * Client Stripe flags (no secret keys in the browser).
 * Secrets live in Supabase Edge Function secrets — see supabase/SETUP.md § Stripe.
 *
 * Copy patterns to js/stripe-config.js / js/stripe-config.local.js as needed.
 */
window.__SALON_SITE_STRIPE = {
  /** After a booking is saved to Supabase, redirect to Stripe Checkout for the deposit */
  depositCheckoutEnabled: true,
  // stripeLiveMode: true,   // optional — Vercel sets from STRIPE_PUBLISHABLE_KEY (pk_live…)
  // publishableKey: "pk_…", // optional — same as Dashboard publishable key; never put sk_ here
};
