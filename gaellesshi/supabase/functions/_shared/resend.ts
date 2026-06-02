/** Shared Resend helper for Edge Functions (Deno). */

export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendResendEmail(opts: {
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
  /** Blind copy (e.g. salon copy of a client confirmation). */
  bcc?: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM");
  if (!key || !from) {
    return { ok: false, error: "RESEND_API_KEY or RESEND_FROM not set" };
  }

  const body: Record<string, unknown> = {
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  };
  if (opts.replyTo) body.reply_to = opts.replyTo;
  if (opts.bcc?.length) body.bcc = opts.bcc;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("Resend API error:", res.status, t);
    return { ok: false, error: t };
  }
  return { ok: true };
}
