/**
 * Verify hairbynadjae_site has prices + covers for every catalog style.
 * Usage: node scripts/verify-site-data.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SUPABASE_URL = "https://xynxvpnfytsyusiuurhu.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5bnh2cG5meXRzeXVzaXV1cmh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjMyNTAsImV4cCI6MjA5MzQ5OTI1MH0.gjdef8S5SQ5WS3seFYmbIbrivLQhLzZIpZKFWoce82g";

function parseStyleIdsFromPricing() {
  const src = fs.readFileSync(path.join(ROOT, "js", "style-pricing.js"), "utf8");
  const ids = [];
  const re = /\{\s*id:\s*"([^"]+)",\s*name:[^,]+,\s*base:\s*(\d+(?:\.\d+)?)\s*\}/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[1] !== "other") ids.push(m[1]);
  }
  return ids;
}

function parseCatalogStyleIds() {
  const html = fs.readFileSync(path.join(ROOT, "styles-catalog.html"), "utf8");
  const ids = new Set();
  const re = /booking\.html\?style=([a-z0-9-]+)/g;
  let m;
  while ((m = re.exec(html))) ids.add(m[1]);
  return [...ids].sort();
}

async function fetchPrices() {
  const url =
    SUPABASE_URL +
    "/rest/v1/hairbynadjae_site?record_type=eq.site_setting&record_key=eq.style_price_overrides&select=data&limit=1";
  const res = await fetch(url, {
    headers: { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY },
  });
  if (!res.ok) throw new Error("price fetch failed " + res.status);
  const rows = await res.json();
  const data = rows[0]?.data;
  const val = data?.value ?? data;
  return val && typeof val === "object" ? val : {};
}

async function fetchCoverKeys() {
  const url =
    SUPABASE_URL +
    "/rest/v1/hairbynadjae_site?record_type=eq.style_cover_image&select=record_key";
  const res = await fetch(url, {
    headers: { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY },
  });
  if (!res.ok) throw new Error("cover fetch failed " + res.status);
  const rows = await res.json();
  return new Set(rows.map((r) => r.record_key).filter(Boolean));
}

async function main() {
  const pricingIds = parseStyleIdsFromPricing();
  const catalogIds = parseCatalogStyleIds();
  const prices = await fetchPrices();
  const covers = await fetchCoverKeys();

  const priceKeys = new Set(Object.keys(prices));
  const missingPricesPricing = pricingIds.filter((id) => !priceKeys.has(id));
  const missingPricesCatalog = catalogIds.filter((id) => !priceKeys.has(id));
  const missingCoversCatalog = catalogIds.filter((id) => !covers.has(id));

  console.log("Priced styles (code):", pricingIds.length);
  console.log("Catalog cards:", catalogIds.length);
  console.log("Prices in Supabase:", priceKeys.size);
  console.log("Covers in Supabase:", covers.size);

  if (missingPricesPricing.length) {
    console.log("\nMissing prices (all priced styles):", missingPricesPricing.join(", "));
  }
  if (missingPricesCatalog.length) {
    console.log("\nMissing prices (catalog):", missingPricesCatalog.join(", "));
  }
  if (missingCoversCatalog.length) {
    console.log("\nMissing covers (catalog):", missingCoversCatalog.join(", "));
  }

  const ok =
    !missingPricesPricing.length && !missingPricesCatalog.length && !missingCoversCatalog.length;
  if (ok) console.log("\nOK — all catalog styles have prices and covers in hairbynadjae_site.");
  else {
    console.log("\nRun: node scripts/sync-all-site-data.mjs");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
