/**
 * Seed full style price map to Supabase hairbynadjae_site (style_price_overrides).
 * Merges bundled defaults with any existing remote prices (remote wins on conflict).
 *
 * Usage: node scripts/seed-style-prices.mjs
 * Env:   ADMIN_ACCESS_CODE (optional, default 0000)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SUPABASE_URL = "https://xynxvpnfytsyusiuurhu.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5bnh2cG5meXRzeXVzaXV1cmh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjMyNTAsImV4cCI6MjA5MzQ5OTI1MH0.gjdef8S5SQ5WS3seFYmbIbrivLQhLzZIpZKFWoce82g";
const ADMIN_CODE = (process.env.ADMIN_ACCESS_CODE || "0000").trim();

function parseDefaultsFromStylePricing() {
  const src = fs.readFileSync(path.join(ROOT, "js", "style-pricing.js"), "utf8");
  const map = {};
  const re = /\{\s*id:\s*"([^"]+)",\s*name:[^,]+,\s*base:\s*(\d+(?:\.\d+)?)\s*\}/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[1] !== "other") map[m[1]] = Math.round(Number(m[2]) * 100) / 100;
  }
  return map;
}

async function fetchExistingPrices() {
  const url =
    SUPABASE_URL +
    "/rest/v1/hairbynadjae_site?record_type=eq.site_setting&record_key=eq.style_price_overrides&select=data&limit=1";
  const res = await fetch(url, {
    headers: { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY },
  });
  if (!res.ok) return {};
  const rows = await res.json();
  const data = rows[0] && rows[0].data;
  const val = data && (data.value != null ? data.value : data);
  return val && typeof val === "object" && !Array.isArray(val) ? val : {};
}

async function savePrices(priceMap) {
  const res = await fetch(SUPABASE_URL + "/functions/v1/admin-salon-site-kv", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + ANON_KEY,
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      admin_code: ADMIN_CODE,
      key: "style_price_overrides",
      value: priceMap,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || res.statusText || String(res.status));
  }
  return body;
}

async function main() {
  const defaults = parseDefaultsFromStylePricing();
  const existing = await fetchExistingPrices();
  const merged = { ...defaults };

  Object.keys(existing).forEach((k) => {
    if (k === "other") return;
    const n = Number(existing[k]);
    if (Number.isFinite(n) && n >= 0) merged[k] = Math.round(n * 100) / 100;
  });

  const defaultCount = Object.keys(defaults).length;
  const existingCount = Object.keys(existing).filter((k) => k !== "other").length;
  const mergedCount = Object.keys(merged).length;

  console.log("Default styles:", defaultCount);
  console.log("Existing in Supabase:", existingCount);
  console.log("Saving full map:", mergedCount, "styles");

  const result = await savePrices(merged);
  console.log("Saved OK.", Object.keys(result.value || merged).length, "prices in Supabase.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
