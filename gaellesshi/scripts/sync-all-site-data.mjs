/**
 * Ensure all site data admin manages lives in Supabase hairbynadjae_site.
 * Runs price seed + missing cover uploads, then verifies.
 *
 * Usage: node scripts/sync-all-site-data.mjs
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runNode(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, script)], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(script + " exited " + code))));
  });
}

async function main() {
  console.log("=== Seeding booking hours ===");
  await runNode("seed-booking-hours.mjs");
  console.log("\n=== Seeding style prices ===");
  await runNode("seed-style-prices.mjs");
  console.log("\n=== Uploading missing catalog covers ===");
  await runNode("upload-catalog-covers.mjs");
  console.log("\n=== Verifying ===");
  await runNode("verify-site-data.mjs");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
