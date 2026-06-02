/**
 * Blooio (Bli) messaging REST API — transactional SMS/iMessage fallback.
 * @see https://docs.blooio.com/guides/message-sending
 */

const DEFAULT_API_BASE = "https://backend.blooio.com/v2/api";

function smsConfigured(): boolean {
  const key = Deno.env.get("BLOOIO_API_KEY")?.trim();
  return Boolean(key);
}

export function isBlooioSmsEnabled(): boolean {
  return smsConfigured();
}

export async function sendBlooioSms(opts: {
  /** E.164, e.g. +15551234567 */
  toE164: string;
  text: string;
  idempotencyKey?: string;
  /** Overrides BLOOIO_FROM_NUMBER when set */
  fromNumber?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = Deno.env.get("BLOOIO_API_KEY")?.trim();
  if (!key) {
    return { ok: false, error: "BLOOIO_API_KEY not set" };
  }

  const from =
    opts.fromNumber?.trim() ||
    Deno.env.get("BLOOIO_FROM_NUMBER")?.trim() ||
    "";

  const baseRaw = Deno.env.get("BLOOIO_API_BASE")?.trim().replace(/\/$/, "") || DEFAULT_API_BASE;
  const encodedChat = encodeURIComponent(opts.toE164);
  const url = `${baseRaw}/chats/${encodedChat}/messages`;

  const body: Record<string, unknown> = { text: opts.text };
  if (from) body.from_number = from;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (opts.idempotencyKey) {
    headers["Idempotency-Key"] = opts.idempotencyKey.slice(0, 250);
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (res.status === 200 || res.status === 202) {
      return { ok: true };
    }

    const t = await res.text();
    console.error("Blooio SMS error:", res.status, t);
    return { ok: false, error: t || String(res.status) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Blooio SMS fetch failed:", msg);
    return { ok: false, error: msg };
  }
}
