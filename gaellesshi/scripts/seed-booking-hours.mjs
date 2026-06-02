/**
 * Seed default working hours to Supabase hairbynadjae_site (booking_hours).
 * Usage: node scripts/seed-booking-hours.mjs
 */
const SUPABASE_URL = "https://xynxvpnfytsyusiuurhu.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5bnh2cG5meXRzeXVzaXV1cmh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjMyNTAsImV4cCI6MjA5MzQ5OTI1MH0.gjdef8S5SQ5WS3seFYmbIbrivLQhLzZIpZKFWoce82g";
const ADMIN_CODE = (process.env.ADMIN_ACCESS_CODE || "0000").trim();

const DEFAULT_HOURS = {
  slotDayStartHour: 8,
  slotDayStartMinute: 0,
  slotDayEndHour: 19,
  slotDayEndMinute: 30,
  slotStepMinutes: 30,
  saturdayLastStartHour: 14,
  saturdayLastStartMinute: 0,
  sameDayLeadMinutes: 30,
  concurrentAppointmentCapacity: 2,
  closedWeekdays: [],
  publicHoursText: "Monday–Sunday: 8:00 AM – 7:30 PM",
};

async function fetchExisting() {
  const url =
    SUPABASE_URL +
    "/rest/v1/hairbynadjae_site?record_type=eq.site_setting&record_key=eq.booking_hours&select=data&limit=1";
  const res = await fetch(url, {
    headers: { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  const data = rows[0]?.data;
  const val = data?.value ?? data;
  return val && typeof val === "object" ? val : null;
}

async function main() {
  const existing = await fetchExisting();
  if (existing) {
    console.log("booking_hours already in Supabase — skipping seed.");
    console.log(JSON.stringify(existing, null, 2));
    return;
  }
  const res = await fetch(SUPABASE_URL + "/functions/v1/admin-salon-site-kv", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + ANON_KEY,
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      admin_code: ADMIN_CODE,
      key: "booking_hours",
      value: DEFAULT_HOURS,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || res.statusText);
  console.log("Seeded booking_hours:", body.value || DEFAULT_HOURS);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
