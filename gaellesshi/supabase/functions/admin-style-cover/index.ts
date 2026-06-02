import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** Browsers preflight multipart + Authorization; gateway 404s often omit CORS — deploy this function. */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-code, baggage, sentry-trace",
  "Access-Control-Max-Age": "86400",
};

const MAX_BYTES = 6 * 1024 * 1024;
const BUCKET = "style-covers";
const TABLE = "hairbynadjae_site";
const RECORD_TYPE = "style_cover_image";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Matches catalog / booking `style` ids (lowercase letters, digits, hyphens). */
function validStyleId(id: string): boolean {
  return /^[a-z0-9-]{1,96}$/.test(id);
}

function storagePathFromRow(row: { data?: { storage_path?: string } } | null): string | null {
  const path = row?.data?.storage_path;
  return typeof path === "string" && path.length > 0 ? path : null;
}

async function saveStyleCoverRow(
  admin: ReturnType<typeof createClient>,
  styleId: string,
  storagePath: string,
): Promise<{ error: { message?: string } | null }> {
  const { data: row, error: selErr } = await admin
    .from(TABLE)
    .select("id")
    .eq("record_type", RECORD_TYPE)
    .eq("record_key", styleId)
    .maybeSingle();
  if (selErr) return { error: selErr };

  const payload = {
    data: { storage_path: storagePath },
    updated_at: new Date().toISOString(),
  };

  if (row?.id) {
    const { error } = await admin.from(TABLE).update(payload).eq("id", row.id);
    return { error: error ?? null };
  }

  const { error } = await admin.from(TABLE).insert({
    record_type: RECORD_TYPE,
    record_key: styleId,
    ...payload,
  });
  return { error: error ?? null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const adminCode = Deno.env.get("ADMIN_ACCESS_CODE")?.trim() || "0000";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase not configured" }, 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ct = req.headers.get("content-type") || "";

  if (ct.includes("application/json")) {
    let body: { admin_code?: string; style_id?: string; remove?: boolean };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const code = (body.admin_code || req.headers.get("x-admin-code") || "").trim();
    if (code !== adminCode) return json({ error: "Unauthorized" }, 401);
    if (!body.remove) return json({ error: "Expected remove: true" }, 400);
    const styleId = body.style_id?.trim();
    if (!styleId || !validStyleId(styleId)) return json({ error: "Invalid style_id" }, 400);

    const { data: row, error: selErr } = await admin
      .from(TABLE)
      .select("data")
      .eq("record_type", RECORD_TYPE)
      .eq("record_key", styleId)
      .maybeSingle();
    if (selErr) return json({ error: selErr.message || "Lookup failed" }, 500);
    const prevPath = storagePathFromRow(row);
    if (!prevPath) return json({ ok: true, removed: false });

    const { error: rmErr } = await admin.storage.from(BUCKET).remove([prevPath]);
    if (rmErr) console.warn("storage remove:", rmErr.message);

    const { error: delErr } = await admin
      .from(TABLE)
      .delete()
      .eq("record_type", RECORD_TYPE)
      .eq("record_key", styleId);
    if (delErr) return json({ error: delErr.message || "Delete failed" }, 500);
    return json({ ok: true, removed: true });
  }

  if (!ct.includes("multipart/form-data")) {
    return json({ error: "Expected multipart/form-data or application/json" }, 400);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Invalid form data" }, 400);
  }

  const code = String(form.get("admin_code") || "").trim();
  if (code !== adminCode) return json({ error: "Unauthorized" }, 401);

  const styleId = String(form.get("style_id") || "").trim();
  if (!styleId || !validStyleId(styleId)) return json({ error: "Invalid style_id" }, 400);

  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Missing file" }, 400);
  if (file.size === 0) return json({ error: "Empty file" }, 400);
  if (file.size > MAX_BYTES) return json({ error: "File too large (max 6MB)" }, 400);

  const mime = (file.type || "").trim().toLowerCase() || "application/octet-stream";
  const ext = MIME_EXT[mime];
  if (!ext) return json({ error: "Use JPG, PNG, WebP, or GIF" }, 400);

  const buf = await file.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return json({ error: "File too large (max 6MB)" }, 400);

  const { data: prev } = await admin
    .from(TABLE)
    .select("data")
    .eq("record_type", RECORD_TYPE)
    .eq("record_key", styleId)
    .maybeSingle();

  const objectPath = `${styleId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(objectPath, buf, {
    contentType: mime,
    upsert: false,
  });
  if (upErr) return json({ error: upErr.message || "Upload failed" }, 500);

  const { error: dbErr } = await saveStyleCoverRow(admin, styleId, objectPath);
  if (dbErr) {
    await admin.storage.from(BUCKET).remove([objectPath]);
    return json({ error: dbErr.message || "Database update failed" }, 500);
  }

  const prevPath = storagePathFromRow(prev);
  if (prevPath && prevPath !== objectPath) {
    const { error: oldErr } = await admin.storage.from(BUCKET).remove([prevPath]);
    if (oldErr) console.warn("remove previous cover:", oldErr.message);
  }

  return json({ ok: true, storage_path: objectPath });
});
