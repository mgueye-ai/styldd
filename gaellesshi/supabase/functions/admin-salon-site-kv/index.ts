import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-code, baggage, sentry-trace",
  "Access-Control-Max-Age": "86400",
};

const TABLE = "hairbynadjae_site";
const RECORD_TYPE = "site_setting";

const KEYS = {
  STYLE_PRICE_OVERRIDES: "style_price_overrides",
  BOOKING_HOURS: "booking_hours",
} as const;

type SettingKey = (typeof KEYS)[keyof typeof KEYS];

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function validStyleId(id: string): boolean {
  return /^[a-z0-9-]{1,96}$/.test(id);
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(v)));
}

function sanitizeOverrides(raw: unknown): Record<string, number> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("value must be a JSON object");
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = k.trim();
    if (!key || !validStyleId(key)) throw new Error(`Invalid style id: ${k}`);
    if (key === "other") continue;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 50000) {
      throw new Error(`Invalid price for ${key}`);
    }
    out[key] = Math.round(n * 100) / 100;
  }
  return out;
}

function sanitizeBookingHours(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("value must be a JSON object");
  }
  const o = raw as Record<string, unknown>;
  const out = {
    slotDayStartHour: clampInt(o.slotDayStartHour, 0, 23, 8),
    slotDayStartMinute: clampInt(o.slotDayStartMinute, 0, 59, 0),
    slotDayEndHour: clampInt(o.slotDayEndHour, 0, 23, 19),
    slotDayEndMinute: clampInt(o.slotDayEndMinute, 0, 59, 30),
    slotStepMinutes: clampInt(o.slotStepMinutes, 15, 120, 30),
    saturdayLastStartHour: clampInt(o.saturdayLastStartHour, 0, 23, 14),
    saturdayLastStartMinute: clampInt(o.saturdayLastStartMinute, 0, 59, 0),
    sameDayLeadMinutes: clampInt(o.sameDayLeadMinutes, 0, 360, 30),
    concurrentAppointmentCapacity: clampInt(o.concurrentAppointmentCapacity, 1, 6, 2),
    closedWeekdays: [] as number[],
    publicHoursText:
      o.publicHoursText != null && String(o.publicHoursText).trim()
        ? String(o.publicHoursText).trim().slice(0, 500)
        : "Monday–Sunday: 8:00 AM – 7:30 PM",
  };
  if (Array.isArray(o.closedWeekdays)) {
    for (const d of o.closedWeekdays) {
      const n = clampInt(d, 0, 6, -1);
      if (n >= 0 && !out.closedWeekdays.includes(n)) out.closedWeekdays.push(n);
    }
    out.closedWeekdays.sort((a, b) => a - b);
  }
  const startM = out.slotDayStartHour * 60 + out.slotDayStartMinute;
  const endM = out.slotDayEndHour * 60 + out.slotDayEndMinute;
  if (endM <= startM) throw new Error("Last slot must be after opening time");
  const satM = out.saturdayLastStartHour * 60 + out.saturdayLastStartMinute;
  if (satM < startM || satM > endM) {
    throw new Error("Saturday last slot must be within opening hours");
  }
  return out;
}

function sanitizeForKey(key: SettingKey, raw: unknown): Record<string, unknown> {
  if (key === KEYS.STYLE_PRICE_OVERRIDES) {
    return sanitizeOverrides(raw) as unknown as Record<string, unknown>;
  }
  if (key === KEYS.BOOKING_HOURS) {
    return sanitizeBookingHours(raw);
  }
  throw new Error("Unsupported key");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const adminCode = Deno.env.get("ADMIN_ACCESS_CODE")?.trim() || "0000";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase not configured" }, 500);

  let body: { admin_code?: string; key?: string; value?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const code = (body.admin_code || req.headers.get("x-admin-code") || "").trim();
  if (code !== adminCode) return json({ error: "Unauthorized" }, 401);

  const key = (body.key || "").trim() as SettingKey;
  if (key !== KEYS.STYLE_PRICE_OVERRIDES && key !== KEYS.BOOKING_HOURS) {
    return json({ error: "Unsupported key" }, 400);
  }

  let cleaned: Record<string, unknown>;
  try {
    cleaned = sanitizeForKey(key, body.value);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Invalid value" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing, error: selErr } = await admin
    .from(TABLE)
    .select("id")
    .eq("record_type", RECORD_TYPE)
    .eq("record_key", key)
    .maybeSingle();
  if (selErr) return json({ error: selErr.message || "Lookup failed" }, 500);

  const payload = {
    data: { value: cleaned },
    updated_at: new Date().toISOString(),
  };

  const { error } = existing?.id
    ? await admin.from(TABLE).update(payload).eq("id", existing.id)
    : await admin.from(TABLE).insert({
        record_type: RECORD_TYPE,
        record_key: key,
        ...payload,
      });

  if (error) return json({ error: error.message || "Upsert failed" }, 500);
  return json({ ok: true, key, value: cleaned });
});
