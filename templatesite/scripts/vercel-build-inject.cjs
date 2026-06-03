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
const styldUrl =
  process.env.STYLD_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";
const styldAnonKey =
  process.env.STYLD_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const styldRootDomain = process.env.STYLD_ROOT_DOMAIN || process.env.EXPO_PUBLIC_STYLD_ROOT_DOMAIN || "styldd.com";
const assetVersion =
  (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 8) ||
  String(Date.now());

function bumpAssetVersion(filePath) {
  if (!fs.existsSync(filePath)) return;
  const html = fs.readFileSync(filePath, "utf8");
  const next = html.replace(/\?v=[^"']+/g, `?v=${assetVersion}`);
  if (next !== html) {
    fs.writeFileSync(filePath, next, "utf8");
    console.log("[vercel-build-inject] Bumped asset ?v= in", path.relative(root, filePath));
  }
}

bumpAssetVersion(path.join(root, "tenant", "index.html"));
bumpAssetVersion(path.join(root, "preview.html"));

const supabasePath = path.join(root, "js", "supabase-config.local.js");
const stripePath = path.join(root, "js", "stripe-config.local.js");

if (url && anonKey) {
  const body =
    `(function () {
  var o = window.__SALON_SITE_SUPABASE;
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

if (stripePk && (stripePk.indexOf("pk_live") === 0 || stripePk.indexOf("pk_test") === 0)) {
  const live = stripePk.indexOf("pk_live") === 0;
  const stripeBody =
    `(function () {
  var o = window.__SALON_SITE_STRIPE;
  if (!o) return;
  o.publishableKey = ${JSON.stringify(stripePk)};
  o.stripeLiveMode = ${live ? "true" : "false"};
})();
`;
  fs.writeFileSync(
    stripePath,
    "/* Generated at build (Vercel). Publishable key only. See scripts/vercel-build-inject.cjs */\n" + stripeBody,
    "utf8",
  );
  console.log("[vercel-build-inject] Wrote js/stripe-config.local.js (stripe " + (live ? "live" : "test") + " mode hint)");
} else if (stripePk) {
  console.warn(
    "[vercel-build-inject] STRIPE_PUBLISHABLE_KEY must start with pk_live or pk_test — skipping stripe-config.local.js",
  );
} else {
  console.warn(
    "[vercel-build-inject] STRIPE_PUBLISHABLE_KEY not set — skipping js/stripe-config.local.js (booking page uses generic Stripe copy).",
  );
}

const tenantPath = path.join(root, "js", "styld-tenant-config.local.js");
if (styldUrl && styldAnonKey) {
  const tenantBody =
    `(function () {
  window.__STYLD_TENANT__ = window.__STYLD_TENANT__ || {};
  window.__STYLD_TENANT__.supabaseUrl = ${JSON.stringify(styldUrl)};
  window.__STYLD_TENANT__.supabaseAnonKey = ${JSON.stringify(styldAnonKey)};
  window.__STYLD_TENANT__.rootDomain = ${JSON.stringify(styldRootDomain)};
  window.__STYLD_TENANT__.marketingUrl = "https://" + ${JSON.stringify(styldRootDomain)};
  window.__STYLD_TENANT__.stripePk = ${JSON.stringify(stripePk && (stripePk.startsWith("pk_live") || stripePk.startsWith("pk_test")) ? stripePk : "")};
})();
`;
  fs.writeFileSync(
    tenantPath,
    "/* Generated at build (Vercel). Do not commit. See scripts/vercel-build-inject.cjs */\n" + tenantBody,
    "utf8",
  );
  console.log("[vercel-build-inject] Wrote js/styld-tenant-config.local.js");
} else {
  console.warn(
    "[vercel-build-inject] STYLD_SUPABASE_URL + STYLD_SUPABASE_ANON_KEY not set — tenant sites will not load on *.styldd.com",
  );
}

process.exit(0);
