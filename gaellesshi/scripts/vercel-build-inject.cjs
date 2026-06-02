/**
 * Vercel build: writes local config from env (files are gitignored locally).
 *
 * Supabase (required for booking):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Stripe client hint (recommended on production — publishable key only, never sk_):
 *   STRIPE_PUBLISHABLE_KEY — pk_live_… or pk_test_… from Stripe Dashboard
 *
 * Important: STRIPE_SECRET_KEY on Vercel does NOT reach Supabase Edge Functions.
 * Set sk_live_… in Supabase → Project Settings → Edge Functions → Secrets as STRIPE_SECRET_KEY
 * and add a live webhook signing secret for stripe-webhook. See supabase/SETUP.md § Stripe.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const stripePk = (process.env.STRIPE_PUBLISHABLE_KEY || "").trim();

const supabasePath = path.join(root, "js", "supabase-config.local.js");
const stripePath = path.join(root, "js", "stripe-config.local.js");

if (url && anonKey) {
  const body =
    `(function () {
  var o = window.__NADJAE_SUPABASE;
  if (!o) return;
  o.url = ${JSON.stringify(url)};
  o.anonKey = ${JSON.stringify(anonKey)};
})();
`;
  fs.writeFileSync(
    supabasePath,
    "/* Generated at build (Vercel). Do not commit. See scripts/vercel-build-inject.cjs */\n" + body,
    "utf8",
  );
  console.log("[vercel-build-inject] Wrote js/supabase-config.local.js");
} else {
  console.warn(
    "[vercel-build-inject] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY not both set — skipping js/supabase-config.local.js (booking may need manual config).",
  );
}

/** Always emit js/stripe-config.local.js so booking.html never 404s the script and the UI can explain missing keys. */
if (stripePk && (stripePk.indexOf("pk_live") === 0 || stripePk.indexOf("pk_test") === 0)) {
  const live = stripePk.indexOf("pk_live") === 0;
  const stripeBody =
    `(function () {
  var o = window.__NADJAE_STRIPE;
  if (!o) return;
  o.publishableKey = ${JSON.stringify(stripePk)};
  o.stripeLiveMode = ${live ? "true" : "false"};
  o.stripePublishableKeyMissingAtBuild = false;
})();
`;
  fs.writeFileSync(
    stripePath,
    "/* Generated at build (Vercel). Publishable key only. See scripts/vercel-build-inject.cjs */\n" + stripeBody,
    "utf8",
  );
  console.log("[vercel-build-inject] Wrote js/stripe-config.local.js (stripe " + (live ? "live" : "test") + " mode hint)");
} else {
  const headComment = stripePk
    ? "// STRIPE_PUBLISHABLE_KEY must start with pk_test_ or pk_live_ — fix Vercel env and redeploy.\n"
    : "// STRIPE_PUBLISHABLE_KEY not set — add pk_test_… or pk_live_… in Vercel → Environment Variables, then redeploy. Pair with STRIPE_SECRET_KEY in Supabase (same test/live mode).\n";
  fs.writeFileSync(
    stripePath,
    headComment +
      `(function () {
  var o = window.__NADJAE_STRIPE;
  if (!o) return;
  o.publishableKey = null;
  o.stripePublishableKeyMissingAtBuild = true;
})();
`,
    "utf8",
  );
  if (stripePk) {
    console.warn("[vercel-build-inject] Invalid STRIPE_PUBLISHABLE_KEY — wrote stub stripe-config.local.js (no card form).");
  } else {
    console.warn("[vercel-build-inject] STRIPE_PUBLISHABLE_KEY not set — wrote stub stripe-config.local.js (no card form).");
  }
}

process.exit(0);
