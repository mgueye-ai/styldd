/**
 * Client-side Stripe flags (no secret keys except publishable pk_…).
 * Deposit checkout runs via Supabase Edge Function (`sk_…` lives in Supabase secrets only).
 * Vercel build can inject `publishableKey` + `stripeLiveMode` — see scripts/vercel-build-inject.cjs
 */
window.__NADJAE_STRIPE = {
  /** Set false in js/stripe-config.local.js to skip Checkout redirect after booking */
  depositCheckoutEnabled: true,
  /**
   * True when using live publishable key (pk_live…). Build sets this on deploy; used for on-page copy only.
   * Charging still depends on STRIPE_SECRET_KEY=sk_live in Supabase Edge Function secrets.
   */
  stripeLiveMode: false,
  /** Stripe publishable key (pk_live_… / pk_test_…) — safe in browser; optional for UI hints */
  publishableKey: null,
};
