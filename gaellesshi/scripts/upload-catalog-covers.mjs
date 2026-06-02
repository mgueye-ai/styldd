/**
 * One-time / maintenance: upload assets/catalog/*.jpg to Supabase style-covers
 * and upsert hairbynadjae_site style_cover_image rows via admin-style-cover.
 *
 * Usage: node scripts/upload-catalog-covers.mjs
 * Env:   ADMIN_ACCESS_CODE (optional, default 0000)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CATALOG_DIR = path.join(ROOT, "assets", "catalog");

const SUPABASE_URL = "https://xynxvpnfytsyusiuurhu.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5bnh2cG5meXRzeXVzaXV1cmh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjMyNTAsImV4cCI6MjA5MzQ5OTI1MH0.gjdef8S5SQ5WS3seFYmbIbrivLQhLzZIpZKFWoce82g";
const ADMIN_CODE = (process.env.ADMIN_ACCESS_CODE || "0000").trim();

/** Same mapping as js/catalog-thumbnails.js */
const FILES = {
  "studio-feedin-2": "feedin-2.jpg",
  "house-feedin-2": "feedin-2.jpg",
  "kids-feedin-2": "feedin-2.jpg",
  "studio-feedin-4": "feedin-4.jpg",
  "house-feedin-4": "feedin-4.jpg",
  "kids-feedin-4": "feedin-4.jpg",
  "studio-feedin-8": "feedin-8.jpg",
  "house-feedin-8": "feedin-8.jpg",
  "kids-feedin-8": "feedin-8.jpg",
  "studio-feedin-10plus": "feedin-10plus.jpg",
  "house-feedin-10plus": "feedin-10plus.jpg",
  "kids-feedin-10plus": "feedin-10plus.jpg",
  "studio-natural-cornrows": "natural-cornrows.jpg",
  "studio-fulani-one": "fulani-one.jpg",
  "house-fulani-one": "fulani-one.jpg",
  "kids-fulani-one": "fulani-one.jpg",
  "studio-wig-install": "wig-install.jpg",
  "house-wig-install": "wig-install.jpg",
  "studio-boho-lg": "boho-lg.jpg",
  "house-boho-lg": "boho-lg.jpg",
  "kids-boho-lg": "boho-lg.jpg",
  "studio-locs-barrels": "locs-barrels.jpg",
  "studio-locs-half-up": "locs-half-up.jpg",
  "studio-boho-md": "boho-md.jpg",
  "house-boho-md": "boho-md.jpg",
  "kids-boho-md": "boho-md.jpg",
  "studio-passion-md": "passion-md.jpg",
  "house-passion-md": "passion-md.jpg",
  "kids-passion-md": "passion-md.jpg",
  "studio-natural-twist": "natural-twist.jpg",
  "kids-natural-twist": "natural-twist.jpg",
  "studio-natural-box": "natural-box.jpg",
  "kids-natural-box": "natural-box.jpg",
  "studio-natural-fulani": "natural-fulani.jpg",
  "studio-natural-2strand": "natural-2strand.jpg",
  "kids-natural-2strand": "natural-2strand.jpg",
  "studio-wig-pony": "wig-pony.jpg",
  "house-wig-pony": "wig-pony.jpg",
  "studio-wig-qw": "wig-qw.jpg",
  "house-wig-qw": "wig-qw.jpg",
  "studio-locs-retwist": "locs-retwist.jpg",
  "studio-boho-sm": "boho-sm.jpg",
  "house-boho-sm": "boho-sm.jpg",
  "studio-passion-sm": "passion-sm.jpg",
  "house-passion-sm": "passion-sm.jpg",
  "kids-passion-sm": "passion-sm.jpg",
  "studio-locs-starter": "locs-starter.jpg",
  "studio-locs-2strand": "locs-2strand.jpg",
  "studio-fulani-passion-twists": "fulani-one.jpg",
  "house-fulani-passion-twists": "fulani-one.jpg",
  "kids-fulani-passion-twists": "fulani-one.jpg",
  "kids-knotless-md": "boho-md.jpg",
  "kids-knotless-lg": "boho-lg.jpg",
  "kids-lemonade-one": "fulani-one.jpg",
};

async function fetchExistingCoverKeys() {
  const url =
    SUPABASE_URL +
    "/rest/v1/hairbynadjae_site?record_type=eq.style_cover_image&select=record_key";
  const res = await fetch(url, {
    headers: {
      apikey: ANON_KEY,
      Authorization: "Bearer " + ANON_KEY,
    },
  });
  if (!res.ok) throw new Error("Failed to list covers: " + res.status);
  const rows = await res.json();
  return new Set(rows.map((r) => r.record_key).filter(Boolean));
}

async function uploadCover(styleId, fileName) {
  const filePath = path.join(CATALOG_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return { styleId, ok: false, error: "missing file " + fileName };
  }

  const buf = fs.readFileSync(filePath);
  const blob = new Blob([buf], { type: "image/jpeg" });
  const form = new FormData();
  form.append("admin_code", ADMIN_CODE);
  form.append("style_id", styleId);
  form.append("file", blob, fileName);

  const res = await fetch(SUPABASE_URL + "/functions/v1/admin-style-cover", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + ANON_KEY,
      apikey: ANON_KEY,
    },
    body: form,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      styleId,
      ok: false,
      error: body.error || res.statusText || String(res.status),
    };
  }
  return { styleId, ok: true, storage_path: body.storage_path };
}

async function main() {
  const existing = await fetchExistingCoverKeys();
  const entries = Object.entries(FILES);
  const toUpload = entries.filter(([id]) => !existing.has(id));
  const skipped = entries.length - toUpload.length;

  console.log("Existing covers:", existing.size);
  console.log("Mapped styles:", entries.length);
  console.log("Skipping (already in Supabase):", skipped);
  console.log("Uploading:", toUpload.length);

  let ok = 0;
  let fail = 0;

  for (const [styleId, fileName] of toUpload) {
    const result = await uploadCover(styleId, fileName);
    if (result.ok) {
      ok++;
      console.log("OK", styleId, "->", result.storage_path);
    } else {
      fail++;
      console.error("FAIL", styleId, result.error);
      if (String(result.error).toLowerCase().includes("unauthorized")) {
        console.error("Set ADMIN_ACCESS_CODE env var to your admin code.");
        process.exit(1);
      }
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log("\nDone.", ok, "uploaded,", fail, "failed,", skipped, "skipped.");
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
